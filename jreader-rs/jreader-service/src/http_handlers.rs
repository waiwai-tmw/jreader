use std::collections::HashMap;
use std::path::{Path as StdPath, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use axum::body::Body;
use axum::extract::Path;
use axum::extract::{Query, State};
use axum::http::HeaderMap;
use axum::response::Response;
use axum::{http::StatusCode, Json};
use axum_typed_multipart::{TryFromMultipart, TypedMultipart};
use base64::{
    engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD},
    Engine as _,
};
use hmac::{Hmac, Mac};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json;
use sha2::Sha256;
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};
use tempfile::NamedTempFile;
use tokio::io::AsyncReadExt;
use tokio::sync::RwLock;
use tracing::{error, info, instrument, warn};
use unicode_normalization::UnicodeNormalization;
use uuid::Uuid;
use yomitan_format::kv_store::utils::ProgressStateTable;

use crate::dictionaries::{DictionaryType, YomitanDictionaries};
use crate::import_progress::{ImportProgressManager, ImportStatus};
use crate::user_preferences::{UserPreferencesStoreAsync, UserPreferencesSupabase};
use crate::users::UsersSupabase;
use crate::xml;
use crate::{conversions, mecab};
use crate::dict_db_scan_fs;

// Helper function to format duration in a human-readable way
fn format_duration(duration: Duration) -> String {
    let total_seconds = duration.as_secs();
    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let seconds = total_seconds % 60;

    if hours > 0 {
        format!("{}h {}m {}s", hours, minutes, seconds)
    } else if minutes > 0 {
        format!("{}m {}s", minutes, seconds)
    } else {
        format!("{}s", seconds)
    }
}

// Resolve the Python interpreter to use for running syosetu2epub script
fn resolve_python_interpreter() -> PathBuf {
    // 1) Allow explicit override via environment variable
    if let Ok(p) = std::env::var("SYOSETU_PYTHON") {
        return PathBuf::from(p);
    }

    // 2) Prefer project venv (relative to CWD at runtime)
    let syosetu_dir = std::env::var("SYOSETU2EPUB_DIR").unwrap_or_else(|_| "syosetu2epub".to_string());
    let venv_rel = StdPath::new(&syosetu_dir).join(".venv/bin/python");
    if venv_rel.is_file() {
        // Use absolute path but don't canonicalize to avoid resolving symlinks
        let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        return current_dir.join(venv_rel);
    }

    // 3) Fallback to system python3 on PATH
    PathBuf::from("python3")
}
use audio_db_query::AudioDB;

/// Extract user ID from request headers (set by auth middleware)
fn extract_user_id_from_headers(headers: &HeaderMap) -> Result<String, String> {
    headers
        .get("user_id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .ok_or_else(|| "User ID not found in headers".to_string())
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LookupTermRequest {
    pub term: String,
    pub position: i32,
}

#[derive(Deserialize, Debug)]
pub struct AudioQueryParams {
    pub term: String,
    pub reading: Option<String>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PitchAccentEntry {
    pub reading: String,
    pub position: u32,
    pub mora_count: u32,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PitchAccentEntryList {
    pub entries: Vec<PitchAccentEntry>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PitchAccentResult {
    pub title: String,
    pub entries: HashMap<String, PitchAccentEntryList>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrequencyData {
    pub term: String,
    pub reading: Option<String>,
    pub value: Option<i32>,
    pub display_value: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrequencyDataList {
    pub items: Vec<FrequencyData>,
}

#[derive(Serialize)]
#[serde(tag = "type")]
#[serde(rename_all = "camelCase")]
pub enum Definition {
    Simple {
        content: String,
    },
    Structured {
        type_: String,
        content: String,
        attributes: HashMap<String, String>,
    },
    Deinflection {
        base_form: String,
        inflections: Vec<String>,
    },
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TermEntry {
    pub text: String,
    pub reading: String,
    pub tags: Vec<String>,
    pub rule_identifiers: String,
    pub score: f64,
    pub definitions: Vec<Definition>,
    pub sequence_number: i64,
    pub term_tags: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DictionaryResult {
    pub title: String,
    pub revision: String,
    pub origin: String,
    pub entries: Vec<TermEntry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LookupTermResponse {
    pub dictionary_results: Vec<DictionaryResult>,
    pub pitch_accent_results: HashMap<String, PitchAccentResult>,
    pub frequency_data_lists: HashMap<String, FrequencyDataList>,
}

#[derive(TryFromMultipart)]
pub struct UploadBookRequest {
    #[form_data(limit = "unlimited")]
    file: NamedTempFile,
}

#[derive(Serialize, Deserialize)]
pub struct TableOfContentsEntry {
    pub label: String,
    pub content_src: String,
    pub play_order: i32,
    pub page_number: i32,
}

#[derive(Deserialize)]
struct EpubMetadataOutput {
    total_pages: i32,
    toc: Vec<TableOfContentsEntry>,
    spine: Vec<String>,
}

#[derive(Serialize)]
pub struct UploadBookResponse {
    title: String,
    author: String,
    total_pages: i32,
    cover_path: Option<String>,
    toc: Vec<TableOfContentsEntry>,
    spine: Vec<String>,
}

#[derive(TryFromMultipart)]
pub struct UploadDictRequest {
    #[form_data(limit = "unlimited")]
    file: NamedTempFile,
    filename: String,
}

pub struct LookupTermContext {
    pub yomi_dicts: Arc<RwLock<YomitanDictionaries>>,
    pub tokenizer: Option<vibrato::Tokenizer>,
    pub user_preferences_db: Arc<RwLock<UserPreferencesSupabase>>,
    pub users_db: Arc<UsersSupabase>,
    pub import_progress_manager: Arc<ImportProgressManager>,
}

#[derive(Deserialize)]
pub struct ScanDictsQuery {
    max_size_mb: Option<u64>,
}

#[derive(Deserialize)]
pub struct WebnovelQuery {
    url: String,
}

#[instrument(skip(context, headers))]
#[axum::debug_handler]
pub async fn lookup_term(
    State(context): State<Arc<LookupTermContext>>,
    headers: HeaderMap,
    Json(payload): Json<LookupTermRequest>,
) -> Result<Json<LookupTermResponse>, (StatusCode, Json<serde_json::Value>)> {
    let term = payload.term;
    let position = payload.position as usize;

    info!(
        "🔍 Looking up term: {} at position {}, char is {}",
        term,
        position,
        term.chars().nth(position).unwrap_or(' ')
    );

    let mut worker = context
        .tokenizer
        .as_ref()
        .ok_or_else(|| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Tokenizer not loaded" })),
            )
        })?
        .new_worker();
    let token_features = mecab::analyze_tokens(&mut worker, &term, position);

    // Get user preferences - either from authenticated user or use defaults
    let user_preferences = if let Some(user_id_header) = headers.get("user_id") {
        // User is authenticated - load their preferences
        let user_id_str = user_id_header.to_str().map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Invalid user_id header" })),
            )
        })?;
        let user_id = Uuid::parse_str(user_id_str).map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Invalid user_id format" })),
            )
        })?;

        context
            .user_preferences_db
            .read()
            .await
            .get(user_id)
            .await
            .map_err(|e| {
                error!(?e, "Failed to get user preferences");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(
                        serde_json::json!({ "error": format!("Failed to get user preferences: {e}") }),
                    ),
                )
            })?
    } else {
        // User is not authenticated - use default preferences (all dictionaries enabled)
        info!("Using default preferences for unauthenticated request");
        let dictionary_info = context.yomi_dicts.read().await.get_dictionaries_info();
        // Use a nil UUID for anonymous users
        crate::user_preferences::UserPreferences::default(Uuid::nil(), dictionary_info)
    };
    let lookup_result = context
        .yomi_dicts
        .read()
        .await
        .lookup(&token_features, &user_preferences)
        .await
        .map_err(|e| {
            error!(?e, "Failed to lookup term");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Failed to lookup term: {e}") })),
            )
        })?;

    info!(
        "📊 Search results: {} entries found. Top entry is {:?}",
        lookup_result.dict.len(),
        lookup_result
            .dict
            .first()
            .map(|d| d.entries.first().map(|e| e.text.clone()))
            .flatten()
    );

    if lookup_result.dict.is_empty() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "No dictionary entries found" })),
        ));
    } else {
        let mut pitch_accent_results: HashMap<String, PitchAccentResult> = HashMap::new();
        for (term, result) in lookup_result.pitch.iter() {
            let mut all_entries: HashMap<String, PitchAccentEntryList> = HashMap::new();
            for (reading, pitch_result) in result.iter() {
                let converted_result = conversions::convert_pitch_result(reading, pitch_result);
                // Merge all entries from this reading into the combined result
                for (entry_reading, entry_list) in converted_result.entries.iter() {
                    all_entries.insert(entry_reading.clone(), entry_list.clone());
                }
            }
            pitch_accent_results.insert(
                term.clone(),
                PitchAccentResult {
                    title: result
                        .values()
                        .next()
                        .map(|pr| pr.title.clone())
                        .unwrap_or_default(),
                    entries: all_entries,
                },
            );
        }

        Ok(Json(LookupTermResponse {
            dictionary_results: lookup_result
                .dict
                .iter()
                .map(conversions::convert_dictionary_result)
                .collect(),
            frequency_data_lists: conversions::convert_frequency_data(&lookup_result.freq),
            pitch_accent_results,
        }))
    }
}

pub async fn upload_book(
    headers: HeaderMap,
    TypedMultipart(upload): TypedMultipart<UploadBookRequest>,
) -> Result<Json<UploadBookResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = headers.get("user_id").unwrap().to_str().unwrap();
    let user_id = Uuid::parse_str(user_id).unwrap();
    info!(?user_id, "Processing uploaded EPUB file");
    let temp_path = upload.file.path();

    let res = get_book_metadata(temp_path).map_err(|e| {
        error!(?e, "Failed to get book metadata");
        (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": format!("Failed to get book metadata: {e}") })),
        )
    })?;
    info!(
        title = res.title,
        author = res.author,
        "Successfully parsed EPUB"
    );
    Ok(Json(res))
}

pub async fn webnovel_start(
    State(context): State<Arc<LookupTermContext>>,
    Query(params): Query<WebnovelQuery>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    info!(url = ?params.url, "=== Starting webnovel import request ===");

    // Extract user ID from JWT token
    let user_id = match extract_user_id_from_headers(&headers) {
        Ok(id) => id,
        Err(e) => {
            error!(?e, "Failed to extract user ID from headers");
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "Unauthorized" })),
            ));
        }
    };

    // Check if user already has an active import
    if context
        .import_progress_manager
        .has_active_imports(&user_id)
        .await
    {
        error!(user_id = %user_id, "User already has an active import");
        return Err((
            StatusCode::CONFLICT,
            Json(serde_json::json!({
                "error": "You already have an import in progress. Please wait for it to complete before starting a new one."
            })),
        ));
    }

    // Clean the URL: strip whitespace and trailing slashes
    let cleaned_url = params.url.trim().trim_end_matches('/');
    info!(original_url = ?params.url, cleaned_url = ?cleaned_url, "URL cleaned");

    // Start tracking import progress
    let import_id = context
        .import_progress_manager
        .start_import(user_id.clone(), cleaned_url.to_string())
        .await;
    info!(import_id = %import_id, user_id = %user_id, "Started tracking import progress");

    // Clone context for background task
    let context_clone = context.clone();
    let cleaned_url_clone = cleaned_url.to_string();
    let import_id_clone = import_id.clone();

    // Spawn background task to handle the actual import
    tokio::spawn(async move {
        webnovel_import_task(context_clone, cleaned_url_clone, import_id_clone).await;
    });

    // Return OK immediately
    info!(import_id = %import_id, "Webnovel import request accepted, processing in background");
    Ok(Json(serde_json::json!({
        "status": "accepted",
        "import_id": import_id
    })))
}

async fn webnovel_import_task(
    context: Arc<LookupTermContext>,
    cleaned_url: String,
    import_id: Uuid,
) {
    // Validate URL format
    if !cleaned_url.contains("syosetu.com") {
        error!(url = ?cleaned_url, "Invalid URL format - must contain syosetu.com");
        context
            .import_progress_manager
            .update_status(
                &import_id,
                ImportStatus::Failed("Invalid URL format".to_string()),
            )
            .await;
        return; // Just return, don't try to return an error from background task
    }
    info!(url = ?cleaned_url, "URL validation passed");
    context
        .import_progress_manager
        .add_log(&import_id, "URL validation passed".to_string())
        .await;

    // Get the path to the syosetu2epub script
    let syosetu_base = std::env::var("SYOSETU2EPUB_DIR").unwrap_or_else(|_| "./syosetu2epub".to_string());
    let syosetu_script_path = std::env::var("SYOSETU_SCRIPT_PATH")
        .unwrap_or_else(|_| format!("{}/syosetu2epub.py", syosetu_base));
    info!(script_path = ?syosetu_script_path, "Using syosetu2epub script path");

    // Run the syosetu2epub script
    info!(script_path = ?syosetu_script_path, url = ?cleaned_url, "Executing syosetu2epub script");

    // Use Python interpreter directly (prefer venv, fallback to system python3)
    let python_path = resolve_python_interpreter();
    info!(python_path = ?python_path, "Using Python interpreter");

    // Get the syosetu2epub directory (parent of the script, fallback to relative path)
    let syosetu_dir = std::path::Path::new(&syosetu_script_path)
        .parent()
        .unwrap_or(std::path::Path::new(&syosetu_base));
    info!(syosetu_dir = ?syosetu_dir, "Using syosetu2epub directory");

    // Run the syosetu2epub script with streaming output
    info!("Executing syosetu2epub script...");
    context
        .import_progress_manager
        .update_status(&import_id, ImportStatus::Downloading)
        .await;
    context
        .import_progress_manager
        .add_log(
            &import_id,
            "Starting webnovel download and processing...".to_string(),
        )
        .await;

    // Get output directory from environment variable
    let output_dir = std::env::var("WEBNOVEL_TEMP_OUTPUT_DIR")
        .unwrap_or_else(|_| std::env::temp_dir().to_string_lossy().to_string());
    info!(output_dir = ?output_dir, "Using output directory for EPUB files");

    let mut cmd = tokio::process::Command::new(&python_path);

    // Use absolute path to avoid issues with current_dir
    let absolute_script_path = std::fs::canonicalize(&syosetu_script_path)
        .unwrap_or_else(|_| std::path::PathBuf::from(&syosetu_script_path));

    cmd.arg(&absolute_script_path)
        .arg(&cleaned_url)
        .arg("--output-dir")
        .arg(&output_dir);

    // Add proxy arguments if environment variables are set
    if let (Ok(username), Ok(password), Ok(host), Ok(port)) = (
        std::env::var("WEBNOVEL_PROXY_USERNAME"),
        std::env::var("WEBNOVEL_PROXY_PASSWORD"),
        std::env::var("WEBNOVEL_PROXY_HOST"),
        std::env::var("WEBNOVEL_PROXY_PORT"),
    ) {
        info!("Adding proxy configuration to syosetu2epub command");
        cmd.arg("--proxy-username")
            .arg(&username)
            .arg("--proxy-password")
            .arg(&password)
            .arg("--proxy-host")
            .arg(&host)
            .arg("--proxy-port")
            .arg(&port);

        // Add Oxylabs-specific parameters if available
        if let Ok(country) = std::env::var("WEBNOVEL_PROXY_COUNTRY") {
            cmd.arg("--proxy-country").arg(&country);

            // Generate a unique session ID for this execution (shorter format)
            let session_id = uuid::Uuid::new_v4().simple().to_string();
            info!(session_id = %session_id, "Generated unique session ID for proxy");
            cmd.arg("--proxy-session-id").arg(&session_id);
        }
        if let Ok(session_time) = std::env::var("WEBNOVEL_PROXY_SESSION_TIME") {
            cmd.arg("--proxy-session-time").arg(&session_time);
        }
    }

    cmd.current_dir(syosetu_dir)
        .env("PYTHONUNBUFFERED", "1") // Key for immediate output
        .env(
            "PATH",
            format!(
                "{}:/usr/local/bin:/usr/bin:/bin",
                std::env::var("PATH").unwrap_or_default()
            ),
        )
        .stdin(std::process::Stdio::null()) // Avoid accidental stdin reads
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(child) => child,
        Err(e) => {
            error!(?e, python_path = ?python_path, "Failed to spawn syosetu2epub script");
            let error_msg = format!("Failed to spawn script: {e}");
            context
                .import_progress_manager
                .update_status(&import_id, ImportStatus::Failed(error_msg))
                .await;
            return; // Exit the background task
        }
    };

    let pid = child.id().unwrap_or(0);
    info!(pid = pid, "Spawned syosetu2epub process");

    // Set the process ID in the progress tracker
    if pid > 0 {
        context
            .import_progress_manager
            .set_process_id(&import_id, pid)
            .await;
    }

    let mut stdout = child.stdout.take().unwrap();
    let mut stderr = child.stderr.take().unwrap();

    // Create tasks to read stdout and stderr concurrently
    let progress_manager = context.import_progress_manager.clone();
    let import_id_clone = import_id.clone();
    let stdout_task = tokio::spawn(async move {
        let mut buffer = [0; 1024];
        let mut output = String::new();
        let mut chapter_count = 0;
        let mut total_chapters = 0;
        let start_time = std::time::Instant::now();

        info!("stdout task started, waiting for data...");

        loop {
            match stdout.read(&mut buffer).await {
                Ok(0) => {
                    info!("stdout EOF reached");
                    break; // EOF
                }
                Ok(n) => {
                    info!(bytes_read = n, "stdout read {} bytes", n);
                    let chunk = String::from_utf8_lossy(&buffer[..n]);
                    output.push_str(&chunk);

                    // Log each line as it comes in and update progress
                    for line in chunk.lines() {
                        if !line.trim().is_empty() {
                            info!(stdout_line = %line, "syosetu2epub output");

                            // Track chapter progress for better user feedback
                            if line.contains("Downloading chapter")
                                || line.contains("Processing chapter")
                            {
                                // Extract chapter numbers from lines like "Downloading chapter 1/100" or "Processing chapter 1/100"
                                if let Ok(re) = Regex::new(r"chapter (\d+)/(\d+)") {
                                    if let Some(cap) = re.captures(line) {
                                        if let (Ok(current), Ok(total)) =
                                            (cap[1].parse::<usize>(), cap[2].parse::<usize>())
                                        {
                                            chapter_count = current;
                                            total_chapters = total;

                                            // Calculate progress and estimated time remaining
                                            let progress_percent = (chapter_count as f64
                                                / total_chapters as f64
                                                * 100.0)
                                                as u32;
                                            let elapsed = start_time.elapsed();

                                            if chapter_count > 1 {
                                                let avg_time_per_chapter =
                                                    elapsed / (chapter_count - 1) as u32;
                                                let remaining_chapters =
                                                    total_chapters - chapter_count;
                                                let estimated_remaining = avg_time_per_chapter
                                                    * remaining_chapters as u32;

                                                let progress_msg = format!(
                                                    "Progress: {}% ({} of {} chapters) - Estimated time remaining: {}",
                                                    progress_percent,
                                                    chapter_count,
                                                    total_chapters,
                                                    format_duration(estimated_remaining)
                                                );

                                                progress_manager
                                                    .add_log(&import_id_clone, progress_msg)
                                                    .await;
                                            }
                                        }
                                    }
                                }
                            }

                            progress_manager
                                .add_log(&import_id_clone, format!("[OUT] {}", line))
                                .await;
                        }
                    }
                }
                Err(e) => {
                    error!(?e, "Error reading stdout");
                    break;
                }
            }
        }
        info!(
            "stdout task completed, total output length: {}",
            output.len()
        );
        output
    });

    let progress_manager_stderr = context.import_progress_manager.clone();
    let import_id_stderr = import_id.clone();
    let stderr_task = tokio::spawn(async move {
        let mut buffer = [0; 1024];
        let mut output = String::new();

        info!("stderr task started, waiting for data...");

        loop {
            match stderr.read(&mut buffer).await {
                Ok(0) => {
                    info!("stderr EOF reached");
                    break; // EOF
                }
                Ok(n) => {
                    info!(bytes_read = n, "stderr read {} bytes", n);
                    let chunk = String::from_utf8_lossy(&buffer[..n]);
                    output.push_str(&chunk);

                    // Log each line as it comes in and update progress
                    for line in chunk.lines() {
                        if !line.trim().is_empty() {
                            warn!(stderr_line = %line, "syosetu2epub output");
                            progress_manager_stderr
                                .add_log(&import_id_stderr, format!("[ERR] {}", line))
                                .await;
                        }
                    }
                }
                Err(e) => {
                    error!(?e, "Error reading stderr");
                    break;
                }
            }
        }
        info!(
            "stderr task completed, total output length: {}",
            output.len()
        );
        output
    });

    // Wait for the process to complete with timeout
    // Get timeout from environment variable, default to 30 minutes for long novels
    let timeout_seconds = std::env::var("WEBNOVEL_TIMEOUT_SECONDS")
        .unwrap_or_else(|_| "1800".to_string()) // 30 minutes default
        .parse::<u64>()
        .unwrap_or(1800); // fallback to 30 minutes if parsing fails

    info!(
        timeout_seconds = timeout_seconds,
        "Waiting for syosetu2epub process to complete..."
    );
    let status = match tokio::time::timeout(
        std::time::Duration::from_secs(timeout_seconds),
        child.wait()
    ).await {
        Ok(status) => status,
        Err(_) => {
            error!(timeout_seconds = timeout_seconds, "syosetu2epub script timed out after {} seconds", timeout_seconds);

            // Kill the process when timeout occurs
            if let Some(pid) = child.id() {
                info!(pid = pid, "Killing syosetu2epub process due to timeout");
                if let Err(kill_err) = child.kill().await {
                    error!(?kill_err, "Failed to kill syosetu2epub process");
                }
            }

            let progress_manager = context.import_progress_manager.clone();
            let import_id_clone = import_id.clone();
            let timeout_minutes = timeout_seconds / 60;
            context
                .import_progress_manager
                .update_status(&import_id, ImportStatus::Failed(format!("Script timed out after {} minutes. For very long novels, consider using the --min and --max flags to process in smaller chunks.", timeout_minutes)))
                .await;
            return; // Exit the background task
        }
    }.unwrap_or_else(|e| {
        error!(?e, "Failed to wait for syosetu2epub script");
        let error_msg = format!("Failed to wait for script: {e}");
        let context_clone = context.clone();
        let import_id_clone = import_id;
        tokio::spawn(async move {
            context_clone
                .import_progress_manager
                .update_status(&import_id_clone, ImportStatus::Failed(error_msg))
                .await;
        });
        std::process::ExitStatus::default() // Return a default exit status
    });

    info!(exit_code = ?status.code(), "syosetu2epub process completed");

    // Get the output from the tasks
    info!("Joining stdout and stderr tasks...");
    let (stdout_result, stderr_result) = tokio::join!(stdout_task, stderr_task);
    info!("Tasks joined successfully");

    let stdout_output = match stdout_result {
        Ok(output) => output,
        Err(e) => {
            error!(?e, "Failed to get stdout from task");
            let error_msg = format!("Failed to get stdout from task: {e}");
            context
                .import_progress_manager
                .update_status(&import_id, ImportStatus::Failed(error_msg))
                .await;
            return; // Exit the background task
        }
    };

    let stderr_output = match stderr_result {
        Ok(output) => output,
        Err(e) => {
            error!(?e, "Failed to get stderr from task");
            let error_msg = format!("Failed to get stderr from task: {e}");
            context
                .import_progress_manager
                .update_status(&import_id, ImportStatus::Failed(error_msg))
                .await;
            return; // Exit the background task
        }
    };

    info!(exit_code = ?status.code(), "syosetu2epub script completed");
    info!(stdout = %stdout_output, "syosetu2epub complete stdout");
    warn!(stderr = %stderr_output, "syosetu2epub complete stderr");

    if !status.success() {
        // Check if this was a cancellation (SIGTERM = exit code 143)
        if status.code() == Some(143) {
            info!(exit_code = ?status.code(), "syosetu2epub script was cancelled by user");
            context
                .import_progress_manager
                .update_status(&import_id, ImportStatus::Cancelled)
                .await;
            return; // Exit the background task - import was cancelled
        }

        error!(exit_code = ?status.code(), stderr = %stderr_output, stdout = %stdout_output, "syosetu2epub script failed");

        // Provide more helpful error messages based on common issues
        let error_message = if stderr_output
            .contains("AttributeError: 'NoneType' object has no attribute 'find_all'")
        {
            "The syosetu page structure has changed or the URL is invalid. Please check that the URL is a valid syosetu novel URL (e.g., https://ncode.syosetu.com/n1234ab/)."
        } else if stderr_output.contains("ConnectionError") || stderr_output.contains("Timeout") {
            "Network error while accessing the syosetu page. Please check your internet connection and try again."
        } else if stderr_output.contains("404") || stderr_output.contains("Not Found") {
            "The novel URL was not found. Please check that the URL is correct and the novel exists."
        } else {
            &stderr_output
        };

        context
            .import_progress_manager
            .update_status(&import_id, ImportStatus::Failed(error_message.to_string()))
            .await;
        return; // Exit the background task
    }

    // Update status to EpubGenerated - EPUB is ready for serving
    context
        .import_progress_manager
        .update_status(&import_id, ImportStatus::EpubGenerated)
        .await;
    context
        .import_progress_manager
        .add_log(
            &import_id,
            "Script completed successfully, processing EPUB...".to_string(),
        )
        .await;

    // Find the generated EPUB file in the output directory
    info!(output_dir = ?output_dir, "Searching for generated EPUB files in output directory");
    let epub_files: Vec<_> = match std::fs::read_dir(&output_dir) {
        Ok(entries) => entries
            .filter_map(|entry| {
                entry.ok().and_then(|entry| {
                    let path = entry.path();
                    if path.extension().and_then(|s| s.to_str()) == Some("epub") {
                        Some(path)
                    } else {
                        None
                    }
                })
            })
            .collect(),
        Err(e) => {
            error!(?e, output_dir = ?output_dir, "Failed to read output directory");
            let error_msg = format!("Failed to read output directory: {e}");
            context
                .import_progress_manager
                .update_status(&import_id, ImportStatus::Failed(error_msg))
                .await;
            return; // Exit the background task
        }
    };

    info!(
        epub_count = epub_files.len(),
        "Found {} EPUB files",
        epub_files.len()
    );
    for (i, epub_path) in epub_files.iter().enumerate() {
        info!(index = i, epub_path = ?epub_path, "EPUB file {}: {:?}", i, epub_path);
    }

    if epub_files.is_empty() {
        error!(output_dir = ?output_dir, "No EPUB files found in output directory");
        let error_msg = "No EPUB file was generated";
        context
            .import_progress_manager
            .update_status(&import_id, ImportStatus::Failed(error_msg.to_string()))
            .await;
        return; // Exit the background task
    }

    let epub_path = &epub_files[0];
    info!(epub_path = ?epub_path, "Using first EPUB file");

    // Extract metadata from the generated EPUB
    info!(epub_path = ?epub_path, "Extracting metadata from EPUB");
    let metadata = match get_book_metadata(epub_path) {
        Ok(metadata) => metadata,
        Err(e) => {
            error!(?e, epub_path = ?epub_path, "Failed to extract metadata from generated EPUB");
            let error_msg = format!("Failed to extract metadata: {e}");
            context
                .import_progress_manager
                .update_status(&import_id, ImportStatus::Failed(error_msg))
                .await;
            return; // Exit the background task
        }
    };
    info!(
        title = %metadata.title,
        author = %metadata.author,
        total_pages = metadata.total_pages,
        toc_entries = metadata.toc.len(),
        spine_entries = metadata.spine.len(),
        "Successfully extracted metadata"
    );

    // Read the EPUB file content
    info!(epub_path = ?epub_path, "Reading EPUB file content");
    let epub_content = match tokio::fs::read(epub_path).await {
        Ok(content) => content,
        Err(e) => {
            error!(?e, epub_path = ?epub_path, "Failed to read generated EPUB file");
            let error_msg = format!("Failed to read EPUB file: {e}");
            context
                .import_progress_manager
                .update_status(&import_id, ImportStatus::Failed(error_msg))
                .await;
            return; // Exit the background task
        }
    };
    info!(
        epub_size_bytes = epub_content.len(),
        "Successfully read EPUB file"
    );

    // Get the filename
    let filename = epub_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("webnovel.epub");
    info!(filename = %filename, "Determined filename");

    // EPUB is already in the output directory, no need to copy or delete
    info!(epub_path = ?epub_path, "EPUB file is ready for serving from output directory");

    // EPUB is ready - status already set to EpubGenerated above
    context
        .import_progress_manager
        .add_log(
            &import_id,
            "EPUB generated and ready for upload".to_string(),
        )
        .await;

    // Background task completed successfully
    info!(filename = %filename, epub_size_bytes = epub_content.len(), "=== Webnovel import completed successfully ===");
}

pub async fn webnovel_fetch(
    State(context): State<Arc<LookupTermContext>>,
    Query(params): Query<WebnovelQuery>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    info!(url = ?params.url, "=== Fetching completed webnovel import ===");

    // Extract user ID from JWT token
    let user_id = match extract_user_id_from_headers(&headers) {
        Ok(id) => id,
        Err(e) => {
            error!(?e, "Failed to extract user ID from headers");
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "Unauthorized" })),
            ));
        }
    };

    // Clean the URL: strip whitespace and trailing slashes
    let cleaned_url = params.url.trim().trim_end_matches('/');
    info!(original_url = ?params.url, cleaned_url = ?cleaned_url, "URL cleaned");

    // Find the import for this URL
    let import = context
        .import_progress_manager
        .get_import_by_url(&user_id, &cleaned_url)
        .await;

    let Some(import) = import else {
        error!(url = ?cleaned_url, "No import found for this URL");
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "No import found for this URL" })),
        ));
    };

    // Check if the import is ready (EpubGenerated status)
    if !matches!(import.status, ImportStatus::EpubGenerated) {
        error!(import_id = %import.id, status = ?import.status, "Import is not ready");
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Import is not ready yet",
                "status": format!("{:?}", import.status)
            })),
        ));
    }

    // Update status to Processing since we're now serving the file
    context
        .import_progress_manager
        .update_status(&import.id, ImportStatus::Processing)
        .await;

    // Get the output directory and find the EPUB file
    let output_dir = std::env::var("WEBNOVEL_TEMP_OUTPUT_DIR")
        .unwrap_or_else(|_| std::env::temp_dir().to_string_lossy().to_string());

    let epub_files: Vec<_> = std::fs::read_dir(&output_dir)
        .map_err(|e| {
            error!(?e, output_dir = ?output_dir, "Failed to read output directory");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to read output directory" })),
            )
        })?
        .filter_map(|entry| {
            entry.ok().and_then(|entry| {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("epub") {
                    Some(path)
                } else {
                    None
                }
            })
        })
        .collect();

    if epub_files.is_empty() {
        error!(output_dir = ?output_dir, "No EPUB files found");
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "No EPUB file was generated" })),
        ));
    }

    let epub_path = &epub_files[0];
    info!(epub_path = ?epub_path, "Using first EPUB file");

    // Extract metadata from the generated EPUB
    let metadata = get_book_metadata(epub_path).map_err(|e| {
        error!(?e, epub_path = ?epub_path, "Failed to extract metadata from generated EPUB");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Failed to extract metadata: {e}") })),
        )
    })?;

    // Read the EPUB file content
    let epub_content = tokio::fs::read(epub_path).await.map_err(|e| {
        error!(?e, epub_path = ?epub_path, "Failed to read generated EPUB file");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Failed to read EPUB file: {e}") })),
        )
    })?;

    // Get the filename
    let filename = epub_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("webnovel.epub");

    info!(filename = %filename, epub_size_bytes = epub_content.len(), "=== Webnovel fetch completed successfully ===");
    Ok(Json(serde_json::json!({
        "metadata": {
            "title": metadata.title,
            "author": metadata.author,
            "total_pages": metadata.total_pages,
            "cover_path": metadata.cover_path,
            "toc": metadata.toc,
            "spine": metadata.spine,
        },
        "filename": filename,
        "import_id": import.id
    })))
}

/// Download a temporary EPUB file for the Next.js API
pub async fn download_webnovel_file(
    State(context): State<Arc<LookupTermContext>>,
    Path(filename): Path<String>,
    headers: HeaderMap,
) -> Result<Response<Body>, (StatusCode, Json<serde_json::Value>)> {
    info!(filename = %filename, "Download request for EPUB file");

    // Check for service-to-service authentication
    let service_token = headers.get("X-Service-Auth").and_then(|v| v.to_str().ok());

    let expected_service_token =
        std::env::var("NEXTJS_TO_RUST_SERVICE_AUTH_TOKEN").unwrap_or_default();

    if service_token != Some(&expected_service_token) || expected_service_token.is_empty() {
        error!("Invalid or missing service authentication token");
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Forbidden: Service authentication required" })),
        ));
    }

    // Also verify user authentication for audit purposes
    let user_id = match extract_user_id_from_headers(&headers) {
        Ok(id) => id,
        Err(e) => {
            error!(?e, "Failed to extract user ID from headers");
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "Unauthorized" })),
            ));
        }
    };

    // Validate filename (basic security check)
    if !filename.ends_with(".epub") || filename.contains("..") || filename.contains("/") {
        error!(filename = %filename, "Invalid filename");
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Invalid filename" })),
        ));
    }

    // Log the request for audit purposes
    info!(filename = %filename, user_id = %user_id, "Service-authenticated EPUB download request");

    // Note: We trust the service authentication token to ensure this request comes from Next.js API
    // The user authentication provides audit logging, but the service token is the primary security mechanism

    let output_dir = std::env::var("WEBNOVEL_TEMP_OUTPUT_DIR")
        .unwrap_or_else(|_| std::env::temp_dir().to_string_lossy().to_string());
    let file_path = std::path::Path::new(&output_dir).join(&filename);

    info!(file_path = ?file_path, "Looking for file");

    // Check if file exists
    if !file_path.exists() {
        error!(file_path = ?file_path, "File not found");
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "File not found" })),
        ));
    }

    // Read file content
    let content = tokio::fs::read(&file_path).await.map_err(|e| {
        error!(?e, file_path = ?file_path, "Failed to read file");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Failed to read file" })),
        )
    })?;

    info!(file_path = ?file_path, content_size = content.len(), "File read successfully");

    // Delete the file after reading (cleanup)
    if let Err(e) = tokio::fs::remove_file(&file_path).await {
        error!(?e, file_path = ?file_path, "Failed to delete temporary file");
        // Don't fail the request if cleanup fails
    } else {
        info!(file_path = ?file_path, "Temporary file deleted after serving");
    }

    // Return file as response
    let body = Body::from(content);
    let response = Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/epub+zip")
        .header(
            "Content-Disposition",
            format!("attachment; filename=\"{}\"", filename),
        )
        .body(body)
        .map_err(|e| {
            error!(?e, "Failed to build response");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Failed to build response" })),
            )
        })?;

    Ok(response)
}

/// Get import progress for the current user
#[instrument(skip(context, headers))]
pub async fn get_import_progress(
    State(context): State<Arc<LookupTermContext>>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    info!("Getting import progress for user");

    // Extract user ID from JWT token
    let user_id = match extract_user_id_from_headers(&headers) {
        Ok(id) => id,
        Err(e) => {
            error!(?e, "Failed to extract user ID from headers");
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "Unauthorized" })),
            ));
        }
    };

    // Get all imports for this user
    let imports = context
        .import_progress_manager
        .get_user_imports(&user_id)
        .await;

    Ok(Json(serde_json::json!({
        "imports": imports
    })))
}

/// Clear completed and cancelled imports for a user
#[instrument(skip(context, headers))]
pub async fn clear_completed_imports(
    State(context): State<Arc<LookupTermContext>>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    info!("Clearing completed imports for user");

    // Extract user ID from JWT token
    let user_id = match extract_user_id_from_headers(&headers) {
        Ok(id) => id,
        Err(e) => {
            error!(error = %e, "Failed to extract user ID from headers");
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "Invalid token" })),
            ));
        }
    };

    // Clear completed and cancelled imports
    let removed_count = context
        .import_progress_manager
        .clear_completed_imports(&user_id)
        .await;

    info!(user_id = %user_id, removed_count = removed_count, "Successfully cleared completed and cancelled imports");
    Ok(Json(serde_json::json!({
        "message": "Completed and cancelled imports cleared successfully",
        "removed_count": removed_count
    })))
}

/// Get all imports for admin (across all users)
#[instrument(skip(context))]
pub async fn get_all_imports_admin(
    State(context): State<Arc<LookupTermContext>>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    info!("Getting all imports for admin");

    // Admin check is handled by the auth middleware
    // Get all imports
    let imports = context.import_progress_manager.get_all_imports().await;

    Ok(Json(serde_json::json!({
        "imports": imports
    })))
}

/// Cancel an import
#[instrument(skip(context, headers))]
pub async fn cancel_import(
    State(context): State<Arc<LookupTermContext>>,
    headers: HeaderMap,
    Path(import_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    info!(import_id = %import_id, "Cancelling import");

    // Parse import_id as Uuid
    let import_id = match Uuid::parse_str(&import_id) {
        Ok(id) => id,
        Err(e) => {
            error!(?e, "Invalid import ID format");
            return Err((
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Invalid import ID format" })),
            ));
        }
    };

    // Extract user ID from JWT token
    let user_id = match extract_user_id_from_headers(&headers) {
        Ok(id) => id,
        Err(e) => {
            error!(?e, "Failed to extract user ID from headers");
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "Unauthorized" })),
            ));
        }
    };

    // Check if the import belongs to this user and is in a cancellable state
    if let Some(progress) = context
        .import_progress_manager
        .get_progress(&import_id)
        .await
    {
        if progress.user_id != user_id {
            error!(import_id = %import_id, user_id = %user_id, "User attempted to cancel another user's import");
            return Err((
                StatusCode::FORBIDDEN,
                Json(serde_json::json!({ "error": "Forbidden" })),
            ));
        }

        // Only allow cancellation during the Downloading phase
        if progress.status != ImportStatus::Downloading {
            error!(import_id = %import_id, status = ?progress.status, "Attempted to cancel import in non-cancellable state");
            return Err((
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Import can only be cancelled during the Downloading phase"
                })),
            ));
        }
    } else {
        error!(import_id = %import_id, "Import not found");
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Import not found" })),
        ));
    }

    // Cancel the import
    match context
        .import_progress_manager
        .cancel_import(&import_id)
        .await
    {
        Ok(_) => {
            info!(import_id = %import_id, "Successfully cancelled import");
            Ok(Json(serde_json::json!({
                "message": "Import cancelled successfully"
            })))
        }
        Err(e) => {
            error!(import_id = %import_id, error = %e, "Failed to cancel import");
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Failed to cancel import: {}", e) })),
            ))
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdateProgressRequest {
    pub status: String,
    pub log: Option<String>,
}

/// Update import progress (called by Next.js API route)
#[instrument(skip(context, headers))]
pub async fn update_import_progress(
    State(context): State<Arc<LookupTermContext>>,
    Path(import_id): Path<String>,
    headers: HeaderMap,
    Json(payload): Json<UpdateProgressRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    info!(import_id = %import_id, status = %payload.status, "Updating import progress");

    // Parse import_id as Uuid
    let import_id = match Uuid::parse_str(&import_id) {
        Ok(id) => id,
        Err(e) => {
            error!(?e, "Invalid import ID format");
            return Err((
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Invalid import ID format" })),
            ));
        }
    };

    // Extract user ID from JWT token
    let user_id = match extract_user_id_from_headers(&headers) {
        Ok(id) => id,
        Err(e) => {
            error!(error = %e, "Failed to extract user ID from headers");
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "Unauthorized" })),
            ));
        }
    };

    // Validate that the import belongs to the user
    if let Some(progress) = context
        .import_progress_manager
        .get_progress(&import_id)
        .await
    {
        if progress.user_id != user_id {
            return Err((
                StatusCode::FORBIDDEN,
                Json(serde_json::json!({ "error": "Import not found or access denied" })),
            ));
        }
    } else {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Import not found" })),
        ));
    }

    // Parse the status string to ImportStatus enum
    let status = match payload.status.as_str() {
        "Unpacking" => ImportStatus::Unpacking,
        "Uploading" => ImportStatus::Uploading,
        "Finalizing" => ImportStatus::Finalizing,
        "Completed" => ImportStatus::Completed,
        status => {
            if status.starts_with("Failed:") {
                ImportStatus::Failed(status[7..].to_string())
            } else {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({ "error": "Invalid status" })),
                ));
            }
        }
    };

    // Update the status
    context
        .import_progress_manager
        .update_status(&import_id, status)
        .await;

    // Add log if provided
    if let Some(log) = payload.log {
        context
            .import_progress_manager
            .add_log(&import_id, log)
            .await;
    }

    info!(import_id = %import_id, "Successfully updated import progress");
    Ok(Json(serde_json::json!({
        "message": "Progress updated successfully"
    })))
}

// Simple hello endpoint
pub async fn say_hello() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "message": "Hello from axum!"
    }))
}

// Health check endpoint for Render
pub async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "jreader-service",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

fn get_book_metadata(filepath: &StdPath) -> Result<UploadBookResponse> {
    let book = xml::load_book(filepath)?;
    let cover_path = book.cover_zip_path.map(|p| p.to_string_lossy().to_string());

    let epub_meta_bin = std::env::var("EPUB_METADATA_BIN")
        .unwrap_or_else(|_| "epub-metadata".to_string());

    let output = std::process::Command::new(&epub_meta_bin)
        .arg(filepath)
        .output()
        .context(format!("Failed to run epub-metadata binary: {epub_meta_bin}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("epub-metadata failed ({}): {stderr}", output.status);
    }

    let epub_meta: EpubMetadataOutput = serde_json::from_slice(&output.stdout)
        .context("Failed to parse epub-metadata JSON output")?;

    Ok(UploadBookResponse {
        title: book.title,
        author: book.author,
        total_pages: epub_meta.total_pages,
        cover_path,
        toc: epub_meta.toc,
        spine: epub_meta.spine,
    })
}

pub async fn print_dicts(State(context): State<Arc<LookupTermContext>>) -> Json<serde_json::Value> {
    let dicts = context.yomi_dicts.read().await;
    let info = dicts.get_dictionaries_info();

    let mut wtr = csv::WriterBuilder::new()
        .quote_style(csv::QuoteStyle::Always) // Always quote fields
        .from_writer(vec![]);

    // Write header row
    wtr.write_record(&["title", "revision", "type"]).unwrap();

    for dict in info {
        let dict_type = match dict.dictionary_type {
            DictionaryType::Term => "0",
            DictionaryType::Pitch => "1",
            DictionaryType::Frequency => "2",
            DictionaryType::Kanji => "3",
        };
        wtr.write_record(&[&dict.title, &dict.revision, dict_type])
            .unwrap();
    }

    let csv_output = String::from_utf8(wtr.into_inner().unwrap()).unwrap();

    Json(serde_json::json!({
        "csv": csv_output
    }))
}

/// Allows the frontend to upload a dictionary file (scanning happens separately)
pub async fn upload_dict(
    _headers: HeaderMap,
    TypedMultipart(upload): TypedMultipart<UploadDictRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    // TODO: Check if user is admin

    let dicts_path = std::env::var("DICTS_PATH")
        .context("DICTS_PATH environment variable not set")
        .map_err(|e| {
            error!(?e, "Failed to get DICTS_PATH");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
        })?;
    let yomitan_dir_path = StdPath::new(&dicts_path).join("yomitan");

    tokio::fs::create_dir_all(&yomitan_dir_path)
        .await
        .map_err(|e| {
            error!(?e, "Failed to create dictionary directory");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Failed to create directory: {e}") })),
            )
        })?;

    tokio::fs::copy(upload.file.path(), yomitan_dir_path.join(&upload.filename))
        .await
        .map_err(|e| {
            error!(?e, "Failed to copy dictionary file");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Failed to copy file: {e}") })),
            )
        })?;

    info!(filename = ?upload.filename, yomitan_dir = ?yomitan_dir_path, "Dictionary uploaded successfully");

    Ok(Json(serde_json::json!({
        "message": format!("Dictionary uploaded successfully: {}", upload.filename)
    })))
}

pub async fn scan_dicts(
    State(context): State<Arc<LookupTermContext>>,
    Query(params): Query<ScanDictsQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    // TODO: Check if user is admin
    let progress_state = Arc::new(ProgressStateTable::new(None).map_err(|e| {
        error!(?e, "Failed to create progress state");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Failed to create progress state: {e}") })),
        )
    })?);
    // Clear out yomi_dicts so that we can scan from scratch
    context.yomi_dicts.write().await.clear();
    let _ = dict_db_scan_fs::scan_fs(
        progress_state,
        Some(context.yomi_dicts.clone()),
        params.max_size_mb,
    )
    .await
    .map_err(|e| {
        error!(?e, "Failed to scan dictionaries");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Failed to scan dictionaries: {e}") })),
        )
    })?;

    let dicts = context.yomi_dicts.read().await;
    let info = dicts.get_dictionaries_info();

    info!(?info, "Dictionaries scanned successfully");

    Ok(Json(serde_json::json!({
        "info": info
    })))
}

/// Custom static file handler that properly handles URL decoding and Unicode normalization
pub async fn serve_static_file(
    Path(file_path): Path<String>,
) -> Result<Response<Body>, (StatusCode, String)> {
    let dicts_path = std::env::var("DICTS_PATH").map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "DICTS_PATH not set".to_string(),
        )
    })?;

    // URL decode the path (Next.js doesn't decode it)
    let decoded_path = urlencoding::decode(&file_path)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid URL encoding".to_string()))?;

    // Normalize the path to NFD for filesystem compatibility (macOS/APFS stores filenames in NFD)
    let normalized_path = decoded_path.nfd().collect::<String>();

    // Construct the full path
    let base_static = StdPath::new(&dicts_path).join("static");
    let full_path = base_static.join(&normalized_path);

    info!(
        "Static file request: {} -> {}",
        file_path,
        full_path.display()
    );

    // Security check: ensure the path is within the static directory
    let static_dir = base_static.canonicalize().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to canonicalize static dir".to_string(),
        )
    })?;

    let canonical_path = full_path
        .canonicalize()
        .map_err(|_| (StatusCode::NOT_FOUND, "File not found".to_string()))?;

    if !canonical_path.starts_with(&static_dir) {
        return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
    }

    // Read the file
    let content = fs::read(&canonical_path)
        .map_err(|_| (StatusCode::NOT_FOUND, "File not found".to_string()))?;

    // Determine content type based on file extension
    let content_type = match full_path.extension().and_then(|s| s.to_str()) {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("css") => "text/css",
        Some("js") => "application/javascript",
        _ => "application/octet-stream",
    };

    let response = Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", content_type)
        .body(Body::from(content))
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to build response".to_string(),
            )
        })?;

    Ok(response)
}

/// Helper function to find an audio file across multiple directories
/// Returns the canonical path of the first matching file found
async fn find_audio_file_in_dirs(
    audio_dirs: &str,
    normalized_path: &str,
) -> Result<PathBuf, (StatusCode, String)> {
    let dirs: Vec<&str> = audio_dirs.split(',').map(|s| s.trim()).collect();

    for audio_dir in dirs {
        let full_path = StdPath::new(audio_dir).join(normalized_path);

        // Try to canonicalize the audio directory
        let canonical_dir = match StdPath::new(audio_dir).canonicalize() {
            Ok(dir) => dir,
            Err(_) => {
                info!("Skipping non-existent audio directory: {}", audio_dir);
                continue;
            }
        };

        // Check if file exists and canonicalize
        if tokio::fs::metadata(&full_path).await.is_ok() {
            if let Ok(canonical_path) = full_path.canonicalize() {
                // Security check: ensure the path is within the audio data directory
                if canonical_path.starts_with(&canonical_dir) {
                    info!(
                        "Found audio file in {}: {}",
                        audio_dir,
                        canonical_path.display()
                    );
                    return Ok(canonical_path);
                }
            }
        }
    }

    Err((
        StatusCode::NOT_FOUND,
        "Audio file not found in any directory".to_string(),
    ))
}

/// Audio file handler that serves audio files from the local-audio-yomichan data directory
pub async fn serve_audio_file(
    headers: HeaderMap,
    Path(file_path): Path<String>,
) -> Result<Response<Body>, (StatusCode, String)> {
    // Check user authentication
    let user_id = headers
        .get("user_id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or_else(|| {
            (
                StatusCode::UNAUTHORIZED,
                "User not authenticated".to_string(),
            )
        })?;

    info!("Serving audio file for authenticated user: {}", user_id);
    let audio_data_dirs = std::env::var("AUDIO_DATA_DIRS").map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "AUDIO_DATA_DIRS not set".to_string(),
        )
    })?;

    // URL decode the path
    let decoded_path = urlencoding::decode(&file_path)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid URL encoding".to_string()))?;

    // Normalize the path to NFD for filesystem compatibility
    let normalized_path = decoded_path.nfd().collect::<String>();

    info!("Audio file request: {}", file_path);

    // Find the file across all audio directories
    let canonical_path = find_audio_file_in_dirs(&audio_data_dirs, &normalized_path).await?;

    // Read the file
    let content = tokio::fs::read(&canonical_path)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "Audio file not found".to_string()))?;

    // Determine content type based on file extension
    let content_type = match canonical_path.extension().and_then(|s| s.to_str()) {
        Some("opus") => "audio/opus",
        Some("mp3") => "audio/mpeg",
        Some("wav") => "audio/wav",
        Some("ogg") => "audio/ogg",
        _ => "audio/opus", // Default to opus
    };

    let response = Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", content_type)
        .header("Accept-Ranges", "bytes")
        .body(Body::from(content))
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to build response".to_string(),
            )
        })?;

    Ok(response)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioResponse {
    pub type_: String,
    pub audio_sources: Vec<AudioSource>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioSource {
    pub name: String,
    pub url: String,
}

/// Audio API endpoint that queries the local-audio-yomichan database
pub async fn get_audio(
    State(context): State<Arc<LookupTermContext>>,
    Query(params): Query<AudioQueryParams>,
) -> Result<Json<AudioResponse>, (StatusCode, Json<serde_json::Value>)> {
    let audio_db_path = std::env::var("AUDIO_DB_PATH").map_err(|_| {
        error!("AUDIO_DB_PATH environment variable not set");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "Audio database not configured" })),
        )
    })?;

    let audio_db = AudioDB::new(&audio_db_path).map_err(|e| {
        error!(?e, "Failed to open audio database at {}", audio_db_path);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Failed to open audio database: {}", e) })),
        )
    })?;

    let entries = if let Some(reading) = &params.reading {
        audio_db.query_by_term_and_reading(&params.term, reading)
    } else {
        audio_db.query_by_term(&params.term)
    }
    .map_err(|e| {
        error!(
            ?e,
            "Failed to query audio database for term: {}", params.term
        );
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Failed to query audio database: {}", e) })),
        )
    })?;

    let audio_sources = entries
        .into_iter()
        .map(|entry| {
            // Construct the correct audio file path: {source}_files/{file}
            let correct_path = format!("{}_files/{}", entry.source, entry.file);
            let url = format!("/audio/{}", correct_path);

            // Construct display name
            let name = if let Some(speaker) = &entry.speaker {
                if let Some(display) = &entry.display {
                    format!("{} ({})", display, speaker)
                } else {
                    format!("{} ({})", entry.source, speaker)
                }
            } else if let Some(display) = &entry.display {
                display.clone()
            } else {
                entry.source.clone()
            };

            AudioSource { name, url }
        })
        .collect();

    Ok(Json(AudioResponse {
        type_: "audioSourceList".to_string(),
        audio_sources,
    }))
}

#[derive(Deserialize)]
pub struct SigQuery {
    exp: u64,
    sig: String,
}

type HmacSha256 = Hmac<Sha256>;

/// Generate HMAC signature for a given path, expiry, and key
/// This matches the Next.js frontend signing logic exactly
pub fn generate_hmac_signature(path: &str, exp: u64, key: &str) -> String {
    let method = "GET";
    let canonical = format!("{method}\n{path}\nexp={}", exp);

    let mut mac = HmacSha256::new_from_slice(key.as_bytes()).unwrap();
    mac.update(canonical.as_bytes());
    let sig_bytes = mac.finalize().into_bytes();
    URL_SAFE_NO_PAD.encode(sig_bytes)
}

/// Verify HMAC signature for signed URLs
/// Returns Ok(()) if signature is valid, Err with appropriate status code otherwise
fn verify_signed_url(
    rel_path: &str,
    q: &SigQuery,
    path_prefix: &str,
    error_prefix: &str,
) -> Result<(), (StatusCode, String)> {
    // 1) Check expiry
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "System time error".to_string(),
            )
        })?
        .as_secs();
    if q.exp < now {
        return Err((StatusCode::UNAUTHORIZED, "URL expired".to_string()));
    }

    // 2) Verify HMAC (must match Next.js signer)
    let key = std::env::var("MEDIA_URL_KEY").map_err(|_| {
        error!("{} MEDIA_URL_KEY not configured", error_prefix);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "MEDIA_URL_KEY not configured".to_string(),
        )
    })?;

    let path_for_sig = format!("{}{}", path_prefix, rel_path);
    let expected_sig = generate_hmac_signature(&path_for_sig, q.exp, &key);

    let sig_bytes = URL_SAFE_NO_PAD
        .decode(q.sig.as_bytes())
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Bad signature (b64)".to_string()))?;

    let actual_sig = URL_SAFE_NO_PAD.encode(sig_bytes);
    if actual_sig != expected_sig {
        return Err((StatusCode::UNAUTHORIZED, "Bad signature".to_string()));
    }

    Ok(())
}

/// Signed URL media handler for serving audio files with HMAC verification
pub async fn serve_signed_media(
    Path(rel_path): Path<String>,
    Query(q): Query<SigQuery>,
    headers: HeaderMap,
) -> Result<Response, (StatusCode, String)> {
    // Verify HMAC signature
    verify_signed_url(&rel_path, &q, "/media/", "🎵")?;

    // 3) Resolve file safely
    let clean = StdPath::new(&rel_path);
    if clean
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err((StatusCode::BAD_REQUEST, "Invalid path".to_string()));
    }

    let audio_dirs = std::env::var("AUDIO_DATA_DIRS").map_err(|_| {
        error!("🎵 AUDIO_DATA_DIRS not configured");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "AUDIO_DATA_DIRS not configured".to_string(),
        )
    })?;

    // Find the file across all audio directories
    let full = find_audio_file_in_dirs(&audio_dirs, rel_path.as_str()).await?;

    let content = tokio::fs::read(&full).await.map_err(|e| {
        error!("🎵 File read error: {}", e);
        (StatusCode::NOT_FOUND, format!("File not found: {}", e))
    })?;

    let meta = tokio::fs::metadata(&full).await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to get file metadata".to_string(),
        )
    })?;
    let total_len = meta.len();

    // 4) MIME type — IMPORTANT for Safari
    // Prefer .ogg for Ogg Opus. If your files have .opus but are Ogg container,
    // force audio/ogg (Safari dislikes audio/opus).
    let mut mime = mime_guess::from_path(&full)
        .first_or_octet_stream()
        .essence_str()
        .to_string();
    if full.extension().and_then(|s| s.to_str()) == Some("opus") {
        // If your container is Ogg Opus:
        mime = "audio/ogg".to_string();
        // If WebM Opus, use: mime = "audio/webm".to_string();
    }

    // 5) Handle Range (Safari requires this)
    let range_hdr = headers.get("range").and_then(|v| v.to_str().ok());

    let mut resp_headers = axum::http::HeaderMap::new();
    resp_headers.insert("Accept-Ranges", "bytes".parse().unwrap());
    resp_headers.insert("Content-Type", mime.parse().unwrap());

    if let Some(range) = range_hdr {
        if let Some(r) = range.strip_prefix("bytes=") {
            let mut parts = r.splitn(2, '-');
            let start: u64 = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
            let end: u64 = parts
                .next()
                .and_then(|e| if e.is_empty() { None } else { e.parse().ok() })
                .unwrap_or(total_len.saturating_sub(1));

            if start > end || end >= total_len {
                return Err((
                    StatusCode::RANGE_NOT_SATISFIABLE,
                    format!("bytes */{total_len}"),
                ));
            }

            let chunk_len = end - start + 1;
            let chunk = content.get(start as usize..(end + 1) as usize).ok_or((
                StatusCode::INTERNAL_SERVER_ERROR,
                "Range read error".to_string(),
            ))?;

            resp_headers.insert(
                "Content-Range",
                format!("bytes {start}-{end}/{total_len}").parse().unwrap(),
            );
            resp_headers.insert("Content-Length", chunk_len.to_string().parse().unwrap());

            let mut response = Response::builder()
                .status(StatusCode::PARTIAL_CONTENT)
                .body(Body::from(chunk.to_vec()))
                .map_err(|_| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "Failed to build response".to_string(),
                    )
                })?;

            *response.headers_mut() = resp_headers;
            return Ok(response);
        }
    }

    // 6) Full response
    resp_headers.insert("Content-Length", total_len.to_string().parse().unwrap());

    let mut response = Response::builder()
        .status(StatusCode::OK)
        .body(Body::from(content))
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to build response".to_string(),
            )
        })?;

    *response.headers_mut() = resp_headers;
    Ok(response)
}

/// Signed URL image handler for serving dictionary images with HMAC verification
pub async fn serve_signed_image(
    Path(rel_path): Path<String>,
    Query(q): Query<SigQuery>,
) -> Result<Response, (StatusCode, String)> {
    // Verify HMAC signature
    verify_signed_url(&rel_path, &q, "/media/img/", "🖼️")?;

    // 3) Resolve file safely with proper Unicode normalization (same as serve_static_file)
    // URL decode the path (Next.js doesn't decode it)
    let decoded_path = urlencoding::decode(&rel_path)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid URL encoding".to_string()))?;

    // Normalize the path to NFD for filesystem compatibility (macOS/APFS stores filenames in NFD)
    let normalized_path = decoded_path.nfd().collect::<String>();

    // Use the same static file path as the existing serve_static_file function
    let static_path = std::env::var("DICTS_PATH").map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "DICTS_PATH not configured".to_string(),
        )
    })?;

    // Construct the full path (same as serve_static_file)
    let base_static = StdPath::new(&static_path).join("static");
    let full_path = base_static.join(&normalized_path);

    // Security check: ensure the path is within the static directory
    let static_dir = base_static.canonicalize().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to canonicalize static dir".to_string(),
        )
    })?;

    let canonical_path = full_path
        .canonicalize()
        .map_err(|_| (StatusCode::NOT_FOUND, "File not found".to_string()))?;

    if !canonical_path.starts_with(&static_dir) {
        return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
    }

    info!(
        "🖼️ Image request: rel_path={}, static_path={}, full_path={}, canonical_path={}",
        rel_path,
        static_path,
        full_path.display(),
        canonical_path.display()
    );

    let content = tokio::fs::read(&canonical_path).await.map_err(|e| {
        error!("🖼️ Image read error: {}", e);
        (StatusCode::NOT_FOUND, format!("Image not found: {}", e))
    })?;

    // 4) MIME type
    let mime = mime_guess::from_path(&canonical_path)
        .first_or_octet_stream()
        .essence_str()
        .to_string();

    // 5) Response headers
    let mut resp_headers = axum::http::HeaderMap::new();
    resp_headers.insert("Content-Type", mime.parse().unwrap());
    resp_headers.insert("Cache-Control", "public, max-age=3600".parse().unwrap());

    // 6) Return response
    let mut response = Response::builder()
        .status(StatusCode::OK)
        .body(Body::from(content))
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to build response".to_string(),
            )
        })?;

    *response.headers_mut() = resp_headers;
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
    use hmac::{Hmac, Mac};
    use sha2::Sha256;
    use std::time::{SystemTime, UNIX_EPOCH};

    // Test setup to ensure clean environment
    fn setup_test_env() {
        // Clear any existing environment variables that might interfere
        std::env::remove_var("DICTS_PATH");
        std::env::remove_var("AUDIO_DATA_DIRS");

        // Set required environment variables for tests
        std::env::set_var("MEDIA_URL_KEY", "test-key-123");
    }

    // Helper to ensure test isolation
    fn ensure_test_isolation() {
        setup_test_env();
        // Add a small delay to ensure any previous test cleanup is complete
        std::thread::sleep(std::time::Duration::from_millis(1));
    }

    #[test]
    fn test_sig_query_deserialization() {
        let json = r#"{"exp": 1234567890, "sig": "test-signature"}"#;
        let sig_query: SigQuery = serde_json::from_str(json).unwrap();

        assert_eq!(sig_query.exp, 1234567890);
        assert_eq!(sig_query.sig, "test-signature");
    }

    #[test]
    fn test_generate_hmac_signature() {
        let path = "/media/test-audio.ogg";
        let exp = 1234567890;
        let key = "test-key-123";

        let signature = generate_hmac_signature(path, exp, key);

        // The signature should be a valid base64 string
        assert!(!signature.is_empty());
        assert!(signature
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_'));

        // The same inputs should produce the same signature
        let signature2 = generate_hmac_signature(path, exp, key);
        assert_eq!(signature, signature2);

        // Different inputs should produce different signatures
        let signature3 = generate_hmac_signature(path, exp + 1, key);
        assert_ne!(signature, signature3);

        let signature4 = generate_hmac_signature(path, exp, "different-key");
        assert_ne!(signature, signature4);
    }

    #[test]
    fn test_verify_signed_url_valid_signature() {
        setup_test_env();

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let exp = now + 3600; // 1 hour in the future

        let path = "test-audio.ogg";
        let path_for_sig = format!("/media/{}", path);
        let sig = generate_hmac_signature(&path_for_sig, exp, "test-key-123");

        let sig_query = SigQuery { exp, sig };

        let result = verify_signed_url(path, &sig_query, "/media/", "🎵");
        assert!(result.is_ok());
    }

    #[test]
    fn test_verify_signed_url_expired() {
        setup_test_env();

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let exp = now - 3600; // 1 hour in the past

        let path = "test-audio.ogg";
        let path_for_sig = format!("/media/{}", path);
        let sig = generate_hmac_signature(&path_for_sig, exp, "test-key-123");

        let sig_query = SigQuery { exp, sig };

        let result = verify_signed_url(path, &sig_query, "/media/", "🎵");
        assert!(result.is_err());

        if let Err((status, message)) = result {
            assert_eq!(status, StatusCode::UNAUTHORIZED);
            assert_eq!(message, "URL expired");
        }
    }

    #[test]
    fn test_verify_signed_url_invalid_signature() {
        setup_test_env();

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let exp = now + 3600; // 1 hour in the future

        let path = "test-audio.ogg";
        let sig = "invalid-signature";

        let sig_query = SigQuery {
            exp,
            sig: sig.to_string(),
        };

        let result = verify_signed_url(path, &sig_query, "/media/", "🎵");
        assert!(result.is_err());

        if let Err((status, message)) = result {
            assert_eq!(status, StatusCode::UNAUTHORIZED);
            assert!(message.contains("Bad signature"));
        }
    }

    #[test]
    fn test_verify_signed_url_wrong_key() {
        setup_test_env();

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let exp = now + 3600; // 1 hour in the future

        let path = "test-audio.ogg";
        let path_for_sig = format!("/media/{}", path);
        let sig = generate_hmac_signature(&path_for_sig, exp, "wrong-key"); // Wrong key

        let sig_query = SigQuery { exp, sig };

        let result = verify_signed_url(path, &sig_query, "/media/", "🎵");
        assert!(result.is_err());

        if let Err((status, message)) = result {
            assert_eq!(status, StatusCode::UNAUTHORIZED);
            assert!(message.contains("Bad signature"));
        }
    }

    #[test]
    fn test_verify_signed_url_invalid_base64() {
        setup_test_env();

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let exp = now + 3600;

        let path = "test-audio.ogg";
        let sig = "invalid-base64!@#"; // Invalid base64

        let sig_query = SigQuery {
            exp,
            sig: sig.to_string(),
        };

        let result = verify_signed_url(path, &sig_query, "/media/", "🎵");
        assert!(result.is_err());

        if let Err((status, message)) = result {
            assert_eq!(status, StatusCode::UNAUTHORIZED);
            assert_eq!(message, "Bad signature (b64)");
        }
    }

    #[test]
    fn test_verify_signed_url_different_path_prefix() {
        setup_test_env();

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let exp = now + 3600;

        let path = "test-image.png";
        // Create signature with /media/ prefix but verify with /media/img/ prefix
        let path_for_sig = format!("/media/{}", path);
        let sig = generate_hmac_signature(&path_for_sig, exp, "test-key-123");

        let sig_query = SigQuery { exp, sig };

        let result = verify_signed_url(path, &sig_query, "/media/img/", "🖼️");
        assert!(result.is_err());

        if let Err((status, message)) = result {
            assert_eq!(status, StatusCode::UNAUTHORIZED);
            assert!(message.contains("Bad signature"));
        }
    }

    #[test]
    fn test_verify_signed_url_image_path() {
        setup_test_env();

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let exp = now + 3600;

        let path = "test-image.png";
        let path_for_sig = format!("/media/img/{}", path);
        let sig = generate_hmac_signature(&path_for_sig, exp, "test-key-123");

        let sig_query = SigQuery { exp, sig };

        let result = verify_signed_url(path, &sig_query, "/media/img/", "🖼️");
        assert!(result.is_ok());
    }

    #[test]
    fn test_verify_signed_url_complex_path() {
        setup_test_env();

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let exp = now + 3600;

        let path = "ja.Wikipedia.2022-12-01.v1.6.1/assets/wikipedia-icon.png";
        let path_for_sig = format!("/media/img/{}", path);
        let sig = generate_hmac_signature(&path_for_sig, exp, "test-key-123");

        let sig_query = SigQuery { exp, sig };

        let result = verify_signed_url(path, &sig_query, "/media/img/", "🖼️");
        assert!(result.is_ok());
    }

    #[test]
    fn test_verify_signed_url_path_with_special_chars() {
        setup_test_env();

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let exp = now + 3600;

        let path = "folder with spaces/file-name_123.jpg";
        let path_for_sig = format!("/media/img/{}", path);
        let sig = generate_hmac_signature(&path_for_sig, exp, "test-key-123");

        let sig_query = SigQuery { exp, sig };

        let result = verify_signed_url(path, &sig_query, "/media/img/", "🖼️");
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_serve_signed_media_invalid_path() {
        setup_test_env();

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let exp = now + 3600;

        let path = "../../../etc/passwd"; // Path traversal attempt
        let path_for_sig = format!("/media/{}", path);
        let sig = generate_hmac_signature(&path_for_sig, exp, "test-key-123");

        let sig_query = SigQuery { exp, sig };
        let headers = HeaderMap::new();

        let result = serve_signed_media(Path(path.to_string()), Query(sig_query), headers).await;

        assert!(result.is_err());

        if let Err((status, message)) = result {
            assert_eq!(status, StatusCode::BAD_REQUEST);
            assert_eq!(message, "Invalid path");
        }
    }

    #[tokio::test]
    async fn test_serve_signed_image_invalid_path() {
        setup_test_env();

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let exp = now + 3600;

        let path = "../../../etc/passwd"; // Path traversal attempt
        let path_for_sig = format!("/media/img/{}", path);
        let sig = generate_hmac_signature(&path_for_sig, exp, "test-key-123");

        let sig_query = SigQuery { exp, sig };

        let result = serve_signed_image(Path(path.to_string()), Query(sig_query)).await;

        assert!(result.is_err());

        if let Err((status, _)) = result {
            // With the new canonicalization approach, path traversal attempts
            // will fail with INTERNAL_SERVER_ERROR when canonicalize() fails
            assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    #[tokio::test]
    async fn test_serve_signed_media_missing_audio_dir() {
        setup_test_env();
        std::env::remove_var("AUDIO_DATA_DIRS");

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let exp = now + 3600;

        let path = "test-audio.ogg";
        let path_for_sig = format!("/media/{}", path);
        let sig = generate_hmac_signature(&path_for_sig, exp, "test-key-123");

        let sig_query = SigQuery { exp, sig };
        let headers = HeaderMap::new();

        let result = serve_signed_media(Path(path.to_string()), Query(sig_query), headers).await;

        assert!(result.is_err());

        if let Err((status, message)) = result {
            assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
            assert_eq!(message, "AUDIO_DATA_DIRS not configured");
        }
    }

    #[tokio::test]
    async fn test_find_audio_file_in_dirs_multiple_directories() {
        use std::fs;
        use tempfile::TempDir;

        // Create temporary directories
        let temp_dir1 = TempDir::new().unwrap();
        let temp_dir2 = TempDir::new().unwrap();

        // Create a test file in the second directory
        let test_file_path = temp_dir2.path().join("test.mp3");
        fs::write(&test_file_path, b"test audio content").unwrap();

        // Create comma-separated directory list
        let audio_dirs = format!(
            "{},{}",
            temp_dir1.path().display(),
            temp_dir2.path().display()
        );

        // Try to find the file
        let result = find_audio_file_in_dirs(&audio_dirs, "test.mp3").await;

        assert!(result.is_ok());
        let found_path = result.unwrap();
        assert!(found_path.exists());
        assert!(found_path.ends_with("test.mp3"));
    }

    #[tokio::test]
    async fn test_find_audio_file_in_dirs_not_found() {
        use tempfile::TempDir;

        // Create temporary directories
        let temp_dir1 = TempDir::new().unwrap();
        let temp_dir2 = TempDir::new().unwrap();

        // Create comma-separated directory list (but don't create the file)
        let audio_dirs = format!(
            "{},{}",
            temp_dir1.path().display(),
            temp_dir2.path().display()
        );

        // Try to find a non-existent file
        let result = find_audio_file_in_dirs(&audio_dirs, "nonexistent.mp3").await;

        assert!(result.is_err());
        if let Err((status, message)) = result {
            assert_eq!(status, StatusCode::NOT_FOUND);
            assert_eq!(message, "Audio file not found in any directory");
        }
    }

    #[tokio::test]
    async fn test_serve_signed_image_missing_dicts_path() {
        // Set up test environment - we need MEDIA_URL_KEY for signature verification
        setup_test_env();
        // Remove DICTS_PATH to test that specific error
        std::env::remove_var("DICTS_PATH");

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let exp = now + 3600;

        let path = "test-image.png";
        let path_for_sig = format!("/media/img/{}", path);
        let sig = generate_hmac_signature(&path_for_sig, exp, "test-key-123");

        let sig_query = SigQuery { exp, sig };

        let result = serve_signed_image(Path(path.to_string()), Query(sig_query)).await;

        assert!(result.is_err());

        if let Err((status, _)) = result {
            // When DICTS_PATH is missing, canonicalize() fails with INTERNAL_SERVER_ERROR
            assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    #[tokio::test]
    async fn test_serve_signed_image_unicode_normalization() {
        ensure_test_isolation();

        // Create a temporary directory structure for testing
        let temp_dir = std::env::temp_dir().join("test-dicts");
        let static_dir = temp_dir.join("static");
        std::fs::create_dir_all(&static_dir).unwrap();
        std::env::set_var("DICTS_PATH", temp_dir.to_string_lossy().to_string());

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let exp = now + 3600;

        // Test with Japanese characters that need normalization
        let path = "[JA-JA Encyclopedia] きっずジャポニカ 新版/img/test.jpg";
        let path_for_sig = format!("/media/img/{}", path);
        let sig = generate_hmac_signature(&path_for_sig, exp, "test-key-123");

        let sig_query = SigQuery { exp, sig };

        let result = serve_signed_image(Path(path.to_string()), Query(sig_query)).await;

        // Should fail with NOT_FOUND since the file doesn't exist, but should not fail with
        // BAD_REQUEST due to Unicode normalization issues
        assert!(result.is_err());

        if let Err((status, _)) = result {
            // Should be NOT_FOUND, not BAD_REQUEST (which would indicate Unicode normalization failure)
            assert_eq!(status, StatusCode::NOT_FOUND);
        }

        // Clean up
        std::fs::remove_dir_all(&temp_dir).ok();
    }

    #[tokio::test]
    async fn test_serve_signed_image_url_encoding() {
        ensure_test_isolation();

        // Create a temporary directory structure for testing
        let temp_dir = std::env::temp_dir().join("test-dicts-url");
        let static_dir = temp_dir.join("static");
        std::fs::create_dir_all(&static_dir).unwrap();
        std::env::set_var("DICTS_PATH", temp_dir.to_string_lossy().to_string());

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let exp = now + 3600;

        // Test with URL-encoded path (like what Next.js sends)
        let raw_path = "[JA-JA%20Encyclopedia]%20きっずジャポニカ%20新版/img/test.jpg";
        let path_for_sig = format!("/media/img/{}", raw_path);
        let sig = generate_hmac_signature(&path_for_sig, exp, "test-key-123");

        let sig_query = SigQuery { exp, sig };

        let result = serve_signed_image(Path(raw_path.to_string()), Query(sig_query)).await;

        // Should fail with NOT_FOUND since the file doesn't exist, but should not fail with
        // BAD_REQUEST due to URL decoding issues
        assert!(result.is_err());

        if let Err((status, _)) = result {
            // Should be NOT_FOUND, not BAD_REQUEST (which would indicate URL decoding failure)
            assert_eq!(status, StatusCode::NOT_FOUND);
        }

        // Clean up
        std::fs::remove_dir_all(&temp_dir).ok();
    }

    #[tokio::test]
    async fn test_serve_signed_image_cross_platform_unicode() {
        ensure_test_isolation();

        // Create a temporary directory structure for testing with a unique name to avoid interference
        let temp_dir = std::env::temp_dir().join(format!(
            "test-dicts-cross-platform-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let static_dir = temp_dir.join("static");
        std::fs::create_dir_all(&static_dir).unwrap();
        std::env::set_var("DICTS_PATH", temp_dir.to_string_lossy().to_string());

        // Japanese character that can be stored differently on different platforms:
        // き (hiragana 'ki') - can be stored as:
        // - NFC (composed): U+304D
        // - NFD (decomposed): U+304B + U+3099 (base + combining mark)
        let japanese_char = "き";

        // Create a directory with the Japanese character
        let dir_path = static_dir.join(format!("[JA-JA Encyclopedia] {} 新版", japanese_char));
        std::fs::create_dir_all(&dir_path).unwrap();

        // Create a test image file
        let img_dir = dir_path.join("img");
        std::fs::create_dir_all(&img_dir).unwrap();
        let test_file = img_dir.join("test.jpg");
        std::fs::write(&test_file, b"fake image data").unwrap();

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let exp = now + 3600;

        // Test 1: Path as it would come from Next.js (potentially in different normalization)
        let path = format!("[JA-JA Encyclopedia] {} 新版/img/test.jpg", japanese_char);
        let path_for_sig = format!("/media/img/{}", path);
        let sig = generate_hmac_signature(&path_for_sig, exp, "test-key-123");
        let sig_query = SigQuery { exp, sig };

        let result = serve_signed_image(Path(path), Query(sig_query)).await;

        // Should succeed regardless of the normalization form used in the path
        assert!(
            result.is_ok(),
            "Should find the file regardless of Unicode normalization"
        );

        // Test 2: URL-encoded path (like what Next.js actually sends)
        let encoded_path = "[JA-JA%20Encyclopedia]%20き%20新版/img/test.jpg";
        let path_for_sig_encoded = format!("/media/img/{}", encoded_path);
        let sig_encoded = generate_hmac_signature(&path_for_sig_encoded, exp, "test-key-123");
        let sig_query_encoded = SigQuery {
            exp,
            sig: sig_encoded,
        };

        let result_encoded =
            serve_signed_image(Path(encoded_path.to_string()), Query(sig_query_encoded)).await;

        // Should also succeed with URL encoding
        assert!(
            result_encoded.is_ok(),
            "Should find the file with URL encoding"
        );

        // Test 3: Verify the file content is correct
        if let Ok(response) = result {
            let (parts, body) = response.into_parts();
            let bytes = axum::body::to_bytes(body, usize::MAX).await.unwrap();
            assert_eq!(bytes.as_ref(), b"fake image data");
            assert_eq!(parts.status, StatusCode::OK);
        }

        // Clean up
        std::fs::remove_dir_all(&temp_dir).ok();
    }
}
