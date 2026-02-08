use anyhow::Result;
use deadpool_postgres::Pool;
use std::sync::Arc;
use uuid::Uuid;

pub struct UsersSupabase {
    pool: Arc<Pool>,
}

impl UsersSupabase {
    pub fn new(pool: Arc<Pool>) -> Self {
        Self { pool }
    }

    pub async fn get_user_tier(&self, user_id: Uuid) -> Result<i16> {
        let client = self.pool.get().await?;

        let row = client
            .query_one(
                r#"SELECT tier FROM "public"."Users" WHERE id = $1"#,
                &[&user_id],
            )
            .await?;

        let tier: i16 = row.get("tier");
        Ok(tier)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_users_supabase() {
        dotenvy::dotenv().unwrap();
        let pool = crate::user_preferences::build_shared_pool(
            &std::env::var("SUPABASE_URL").unwrap(),
            std::env::var("SUPABASE_PORT").unwrap().parse().unwrap(),
            &std::env::var("SUPABASE_USER").unwrap(),
            &std::env::var("SUPABASE_PASSWORD").unwrap(),
            &std::env::var("SUPABASE_DATABASE").unwrap(),
        )
        .unwrap();
        let users_db = UsersSupabase::new(Arc::new(pool));

        // Test with a known user ID (you'll need to replace this with a real user ID from your database)
        let test_user_id = Uuid::new_v4();
        let result = users_db.get_user_tier(test_user_id).await;
        // This will likely fail if the user doesn't exist, but it tests the connection
        println!("User tier result: {:?}", result);
    }
}
