pub mod auth;
pub mod conversions;
pub mod dict_db_scan_fs;
pub mod dictionaries;
pub mod import_progress;
pub mod mecab;
pub mod user_preferences;
pub mod users;
pub mod xml;
pub mod zip_utils;

use std::path::{Path, PathBuf};
use std::sync::Arc;

use anyhow::{Context, Error};
use auth::AuthLayer;
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post},
    Router,
};
use camino::Utf8Path;
use dictionaries::YomitanDictionaries;
use import_progress::ImportProgressManager;
use tokio::sync::RwLock;
use tower::ServiceBuilder;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use tracing::{info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use user_preferences::UserPreferencesSupabase;
use users::UsersSupabase;

pub mod http_handlers; // New module for axum handlers

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| {
                "jreader_service_server=debug,jreader_service=debug,jreader_service::http_handlers=debug,yomitan_format=debug,info"
                    .into()
            }),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    run_http_server().await?;

    Ok(())
}

async fn run_http_server() -> Result<(), Error> {
    dotenvy::dotenv().context(format!("Failed to load .env file"))?;
    let port = 3001;
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
        .await
        .context(format!("Failed to bind to port {}", port))?;
    info!("🚀 Starting HTTP server on port: {port}");

    // Test syosetu2epub script availability early in startup
    test_syosetu2epub_availability().await;

    // Ensure output directory exists
    // ensure_output_directory().await;

    let dicts_path = std::env::var("DICTS_PATH").context(format!("Failed to load DICTS_PATH"))?;

    let yomi_dicts = {
        Arc::new(RwLock::new(
            YomitanDictionaries::new(Utf8Path::new(format!("{}/db", dicts_path).as_str()))
                .context(format!("Failed to load Yomitan dictionaries"))?,
        ))
    };

    let tokenizer = {
        let mecab_dict_path =
            std::env::var("MECAB_DICT_PATH").context(format!("Failed to load MECAB_DICT_PATH"))?;
        if Path::new(&mecab_dict_path).exists() {
            let file = std::fs::File::open(mecab_dict_path.clone()).context(format!(
                "Failed to open MeCab dictionary file: {}",
                mecab_dict_path
            ))?;
            let reader = zstd::Decoder::new(file).context(format!(
                "Failed to create zstd decoder for MeCab dictionary file: {}",
                mecab_dict_path
            ))?;
            let dict = vibrato::Dictionary::read(reader).context(format!(
                "Failed to read MeCab dictionary file: {}",
                mecab_dict_path
            ))?;
            let tokenizer = vibrato::Tokenizer::new(dict);
            info!(
                ?mecab_dict_path,
                "✅ Tokenizer loaded successfully, using MeCab dictionary"
            );
            Some(tokenizer)
        } else {
            warn!(?mecab_dict_path, "MeCab dictionary file does not exist");
            None
        }
    };

    let dictionary_info = yomi_dicts.read().await.get_dictionaries_info();

    // Create a single shared connection pool for Supabase
    let pool = user_preferences::build_shared_pool(
        &std::env::var("SUPABASE_URL").context(format!("Failed to load SUPABASE_URL"))?,
        std::env::var("SUPABASE_PORT")
            .context(format!("Failed to load SUPABASE_PORT"))?
            .parse()
            .context(format!("Failed to parse SUPABASE_PORT"))?,
        &std::env::var("SUPABASE_USER").context(format!("Failed to load SUPABASE_USER"))?,
        &std::env::var("SUPABASE_PASSWORD").context(format!("Failed to load SUPABASE_PASSWORD"))?,
        &std::env::var("SUPABASE_DATABASE").context(format!("Failed to load SUPABASE_DATABASE"))?,
    )
    .context(format!("Failed to create shared database pool"))?;

    // Test the pool connection
    let _client = pool.get().await.context("Failed to get client from pool")?;
    info!("✅ Shared database pool created and tested successfully");

    let shared_pool = std::sync::Arc::new(pool);

    // Create database services using the shared pool
    let user_preferences_db =
        user_preferences::UserPreferencesSupabase::new(shared_pool.clone(), dictionary_info);
    info!("✅ User preferences database service created");

    let users_db = users::UsersSupabase::new(shared_pool.clone());
    info!("✅ Users database service created");

    let import_progress_manager = Arc::new(ImportProgressManager::new());
    info!("✅ Import progress manager created");

    // Create the context
    let context = Arc::new(http_handlers::LookupTermContext {
        yomi_dicts,
        tokenizer,
        user_preferences_db: Arc::new(RwLock::new(user_preferences_db)),
        users_db: Arc::new(users_db),
        import_progress_manager,
    });

    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let auth_layer = AuthLayer::new().context(format!("Failed to load AuthLayer"))?;

    // Create a router for dictionary uploads with higher limit
    let dict_router = Router::new()
        .route("/api/upload-dict", post(http_handlers::upload_dict))
        .layer(DefaultBodyLimit::max(1024 * 1024 * 500)); // 500MB for dictionaries

    // Create authenticated API router
    let api_router = Router::new()
        .route("/api/upload", post(http_handlers::upload_book))
        .route("/api/webnovel", post(http_handlers::webnovel_start))
        .route("/api/webnovel", get(http_handlers::webnovel_fetch))
        .route(
            "/api/webnovel/download/:filename",
            get(http_handlers::download_webnovel_file),
        )
        .route(
            "/api/import-progress",
            get(http_handlers::get_import_progress),
        )
        .route(
            "/api/import-progress/admin",
            get(http_handlers::get_all_imports_admin),
        )
        .route(
            "/api/import-progress/clear",
            post(http_handlers::clear_completed_imports),
        )
        .route(
            "/api/import-progress/:import_id/cancel",
            post(http_handlers::cancel_import),
        )
        .route(
            "/api/import-progress/:import_id/update",
            post(http_handlers::update_import_progress),
        )
        .route("/api/hello", get(http_handlers::say_hello))
        .route("/api/print-dicts", get(http_handlers::print_dicts))
        .route("/api/scan-dicts", get(http_handlers::scan_dicts))
        .merge(dict_router) // Merge the dictionary router
        .layer(DefaultBodyLimit::max(1024 * 1024 * 250)) // 250MB for books
        .with_state(context.clone())
        .layer(auth_layer);

    // Create main router with static file serving (no auth) and authenticated API routes
    let static_path = format!("{}/static", dicts_path);
    info!("Serving static files from: {}", static_path);

    // Create a router for audio files with authentication
    let audio_auth_layer = AuthLayer::new().context("Failed to load AuthLayer for audio")?;
    let audio_router = Router::new()
        .route("/audio/*path", get(http_handlers::serve_audio_file))
        .layer(audio_auth_layer);

    // Create a router for signed media URLs (no auth needed - signature provides auth)
    let signed_media_router = Router::new()
        .route("/media/*path", get(http_handlers::serve_signed_media))
        .route("/media/img/*path", get(http_handlers::serve_signed_image));

    // Create a router for health check (no auth needed)
    let health_router = Router::new().route("/healthz", get(http_handlers::health_check));

    let app = Router::new()
        .route("/dicts/*path", get(http_handlers::serve_static_file))
        .route("/api/lookup", post(http_handlers::lookup_term))
        .route("/api/audio", get(http_handlers::get_audio))
        .merge(health_router)
        .merge(audio_router)
        .merge(signed_media_router)
        .merge(api_router)
        .with_state(context.clone())
        .layer(cors);

    axum::serve(listener, app)
        .await
        .context(format!("Failed to serve HTTP server"))?;

    Ok(())
}

// Resolve the Python interpreter to use for running syosetu2epub script
fn resolve_python_interpreter() -> PathBuf {
    // 1) Allow explicit override via environment variable
    if let Ok(p) = std::env::var("SYOSETU_PYTHON") {
        return PathBuf::from(p);
    }

    // 2) Prefer project venv (relative to CWD at runtime)
    let syosetu_dir = std::env::var("SYOSETU2EPUB_DIR").unwrap_or_else(|_| "syosetu2epub".to_string());
    let venv_rel = PathBuf::from(&syosetu_dir).join(".venv/bin/python");
    if venv_rel.is_file() {
        // Use absolute path but don't canonicalize to avoid resolving symlinks
        let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        return current_dir.join(venv_rel);
    }

    // 3) Fallback to system python3 on PATH
    PathBuf::from("python3")
}

async fn test_syosetu2epub_availability() {
    // Get the path to the syosetu2epub script (same logic as in http_handlers)
    let syosetu_base = std::env::var("SYOSETU2EPUB_DIR").unwrap_or_else(|_| "./syosetu2epub".to_string());
    let syosetu_script_path = std::env::var("SYOSETU_SCRIPT_PATH")
        .unwrap_or_else(|_| format!("{}/syosetu2epub.py", syosetu_base));

    // Use Python interpreter directly (prefer venv, fallback to system python3)
    let python_path = resolve_python_interpreter();

    // Get the syosetu2epub directory (parent of the script, fallback to relative path)
    let syosetu_dir = std::path::Path::new(&syosetu_script_path)
        .parent()
        .unwrap_or(std::path::Path::new(&syosetu_base));

    info!(
        script_path = ?syosetu_script_path,
        python_path = ?python_path,
        syosetu_dir = ?syosetu_dir,
        "Testing syosetu2epub script availability..."
    );

    // Check if script file exists
    if !std::path::Path::new(&syosetu_script_path).exists() {
        warn!(
            "❌ syosetu2epub script file does not exist at: {}",
            syosetu_script_path
        );
        return;
    }

    // Debug: Check if Python interpreter exists
    if !std::path::Path::new(&python_path).exists() {
        warn!(
            "❌ Python interpreter does not exist at: {}",
            python_path.display()
        );
        return;
    }

    // Debug: Check if syosetu directory exists
    if !std::path::Path::new(syosetu_dir).exists() {
        warn!(
            "❌ syosetu directory does not exist at: {}",
            syosetu_dir.display()
        );
        return;
    }

    info!(
        script_exists = std::path::Path::new(&syosetu_script_path).exists(),
        python_exists = std::path::Path::new(&python_path).exists(),
        dir_exists = std::path::Path::new(syosetu_dir).exists(),
        "🔍 DEBUG: All paths verified"
    );

    // Check if Python interpreter is available
    match tokio::process::Command::new(&python_path)
        .arg("--version")
        .output()
        .await
    {
        Ok(output) => {
            if output.status.success() {
                info!(
                    "✅ Python interpreter is available: {}",
                    String::from_utf8_lossy(&output.stdout).trim()
                );
            } else {
                warn!(
                    "⚠️ Python interpreter failed with status: {:?}",
                    output.status
                );
                return;
            }
        }
        Err(e) => {
            warn!("❌ Python interpreter not found: {}", e);
            warn!("Please ensure Python is installed and in your PATH, or set SYOSETU_PYTHON environment variable");
            return;
        }
    }

    // Test if we can run the script with --help
    // Use absolute path to avoid issues with current_dir
    let absolute_script_path = std::fs::canonicalize(&syosetu_script_path)
        .unwrap_or_else(|_| std::path::PathBuf::from(&syosetu_script_path));

    info!(
        python_path = ?python_path,
        script_path = ?syosetu_script_path,
        absolute_script_path = ?absolute_script_path,
        current_dir = ?syosetu_dir,
        "🔍 DEBUG: About to execute command: {} {} --help (from dir: {})",
        python_path.display(),
        absolute_script_path.display(),
        syosetu_dir.display()
    );

    match tokio::process::Command::new(&python_path)
        .arg(&absolute_script_path)
        .arg("--help")
        .current_dir(syosetu_dir)
        .env("PYTHONUNBUFFERED", "1")
        .env("PYTHONUTF8", "1")
        .output()
        .await
    {
        Ok(output) => {
            if output.status.success() {
                info!("✅ syosetu2epub script is available and working");
                info!(
                    "Script help output: {}",
                    String::from_utf8_lossy(&output.stdout)
                );
            } else {
                warn!(
                    "⚠️ syosetu2epub script failed with status: {:?}",
                    output.status
                );
                warn!("Error output: {}", String::from_utf8_lossy(&output.stderr));
            }
        }
        Err(e) => {
            warn!("❌ Failed to execute syosetu2epub script: {}", e);
            warn!("This may indicate Python is not in PATH or the script path is incorrect");
        }
    }
}

async fn ensure_output_directory() {
    // Get output directory from environment variable
    let output_dir = std::env::var("WEBNOVEL_TEMP_OUTPUT_DIR")
        .unwrap_or_else(|_| std::env::temp_dir().to_string_lossy().to_string());

    info!(output_dir = ?output_dir, "Ensuring clean output directory for EPUB files");

    // Remove the directory if it exists (clears all contents)
    if std::path::Path::new(&output_dir).exists() {
        match std::fs::remove_dir_all(&output_dir) {
            Ok(_) => {
                info!(output_dir = ?output_dir, "🗑️ Removed existing output directory");
            }
            Err(e) => {
                warn!(
                    ?e,
                    output_dir = ?output_dir,
                    "⚠️ Failed to remove existing output directory"
                );
            }
        }
    }

    // Create the directory fresh
    match std::fs::create_dir_all(&output_dir) {
        Ok(_) => {
            info!(output_dir = ?output_dir, "✅ Created clean output directory");
        }
        Err(e) => {
            warn!(
                ?e,
                output_dir = ?output_dir,
                "❌ Failed to create output directory. EPUB generation will fail."
            );
        }
    }
}
