use anyhow::Result;
use axum::body::Body;
use axum::http::StatusCode;
use axum::{extract::Request, response::Response};
use jsonwebtoken::{DecodingKey, Validation};
use serde::Deserialize;
use serde_json::json;
use std::convert::Infallible;
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};
use tower::{Layer, Service};
use tracing::{debug, trace, warn};

pub trait AuthService: Send + Sync {
    fn verify_token(
        &self,
        token: String,
    ) -> impl std::future::Future<Output = Result<String>> + Send;
}

#[derive(Clone)]
pub struct AuthLayer<A: AuthService> {
    pub auth_service: A,
}

impl AuthLayer<AuthServiceImpl> {
    pub fn new() -> Result<Self> {
        let supabase_jwt_secret = std::env::var("SUPABASE_JWT_SECRET")?;
        Ok(Self {
            auth_service: AuthServiceImpl {
                supabase_decoding_key: DecodingKey::from_secret(supabase_jwt_secret.as_bytes()),
            },
        })
    }
}

impl<S, A> Layer<S> for AuthLayer<A>
where
    A: AuthService + Clone + Send + Sync + 'static,
{
    type Service = AuthMiddleware<S, A>;

    fn layer(&self, inner: S) -> Self::Service {
        AuthMiddleware {
            inner,
            auth_service: self.auth_service.clone(),
        }
    }
}

#[derive(Debug, Deserialize)]
struct Claims {
    sub: String, // The Supabase user id (UUID)
    email: String,
    role: String,
    iss: String,
    exp: i64,
    user_metadata: UserMetadata,
}

#[derive(Debug, Deserialize)]
struct UserMetadata {
    avatar_url: String,
    full_name: String,
    custom_claims: CustomClaims,
}

#[derive(Debug, Deserialize)]
struct CustomClaims {
    global_name: String, // The Discord display name
}

#[derive(Clone)]
pub struct AuthServiceImpl {
    supabase_decoding_key: DecodingKey,
}

impl AuthService for AuthServiceImpl {
    async fn verify_token(&self, token: String) -> Result<String> {
        let mut validation = Validation::new(jsonwebtoken::Algorithm::HS256);
        validation.set_audience(&["authenticated"]);
        let decoded =
            jsonwebtoken::decode::<Claims>(&token, &self.supabase_decoding_key, &validation)?;
        Ok(decoded.claims.sub)
    }
}

#[derive(Clone)]
pub struct AuthMiddleware<S, A> {
    inner: S,
    auth_service: A,
}

fn is_admin_route(path: &str) -> bool {
    matches!(
        path,
        "/api/upload-dict" | "/api/print-dicts" | "/api/scan-dicts" | "/api/import-progress/admin"
    )
}

impl<S, A> Service<Request> for AuthMiddleware<S, A>
where
    S: Service<Request, Response = Response, Error = Infallible> + Clone + Send + 'static,
    S::Future: Send + 'static,
    A: AuthService + Clone + Send + Sync + 'static,
{
    type Response = S::Response;
    type Error = Infallible;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, mut req: Request) -> Self::Future {
        let auth_service = self.auth_service.clone();
        let mut inner = self.inner.clone();

        Box::pin(async move {
            let token = req
                .headers()
                .get("Authorization")
                .and_then(|v| v.to_str().ok())
                .map(|t| {
                    trace!("Token before: {:?}", t);
                    let stripped = t.strip_prefix("Bearer ");
                    trace!("Token after: {:?}", stripped);
                    stripped.unwrap_or(t).trim().to_string()
                });

            let user_id = match token {
                Some(token) => match auth_service.verify_token(token).await {
                    Ok(user_id) => {
                        trace!("User ID: {:?}", user_id);
                        req.headers_mut()
                            .insert("user_id", user_id.parse().unwrap());
                        user_id
                    }
                    Err(_) => {
                        return Ok(Response::builder()
                            .status(StatusCode::UNAUTHORIZED)
                            .body(axum::body::Body::from("Invalid token"))
                            .unwrap())
                    }
                },
                None => {
                    return Ok(Response::builder()
                        .status(StatusCode::UNAUTHORIZED)
                        .body(axum::body::Body::from("No authorization token provided"))
                        .unwrap())
                }
            };

            if is_admin_route(req.uri().path()) {
                // Get admin user id from env
                let admin_user_id = std::env::var("ADMIN_SUPABASE_UID").unwrap();
                if user_id != admin_user_id {
                    warn!(route = ?req.uri().path(), user_id = ?user_id, "User is not an admin");
                    return Ok(Response::builder()
                        .status(StatusCode::FORBIDDEN)
                        .body(axum::body::Body::from(
                            json!({
                                "error": "Administrator access required"
                            })
                            .to_string(),
                        ))
                        .unwrap());
                } else {
                    debug!(route = ?req.uri().path(), user_id = ?user_id, "User is an admin");
                }
            }

            inner.call(req).await
        })
    }
}
