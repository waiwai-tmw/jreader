use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportProgress {
    pub id: Uuid,
    pub user_id: String,
    pub url: String,
    pub status: ImportStatus,
    pub logs: Vec<String>,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub process_id: Option<u32>,
    pub total_chapters: Option<u32>,
    pub current_chapter: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ImportStatus {
    Starting,
    Downloading,
    EpubGenerated,
    Processing,
    Unpacking,
    Uploading,
    Finalizing,
    Completed,
    Failed(String),
    Cancelled,
}

impl ImportProgress {
    pub fn new(id: Uuid, user_id: String, url: String) -> Self {
        let now = chrono::Utc::now();
        Self {
            id,
            user_id,
            url,
            status: ImportStatus::Starting,
            logs: Vec::new(),
            started_at: now,
            updated_at: now,
            process_id: None,
            total_chapters: None,
            current_chapter: None,
        }
    }

    pub fn add_log(&mut self, log: String) {
        debug!(user_id = %self.user_id, log = %log, "Adding import log");
        self.logs.push(log.clone());
        self.parse_chapter_progress(&log);
        self.updated_at = chrono::Utc::now();
    }

    pub fn update_status(&mut self, status: ImportStatus) {
        debug!(user_id = %self.user_id, status = ?status, "Updating import status");
        self.status = status;
        self.updated_at = chrono::Utc::now();
    }

    pub fn set_process_id(&mut self, process_id: u32) {
        debug!(user_id = %self.user_id, process_id = process_id, "Setting process ID");
        self.process_id = Some(process_id);
        self.updated_at = chrono::Utc::now();
    }

    pub fn parse_chapter_progress(&mut self, log: &str) {
        // Parse "Starting download of X chapters..." to get total chapter count
        if log.contains("Starting download of") && log.contains("chapters...") {
            if let Some(chapter_count) =
                self.extract_number_from_log(log, "Starting download of ", " chapters...")
            {
                self.total_chapters = Some(chapter_count);
                debug!(user_id = %self.user_id, total_chapters = chapter_count, "Parsed total chapter count");
            }
        }

        // Parse "Downloading chapter X/Y" to get current chapter progress
        if log.contains("Downloading chapter") && log.contains("/") {
            if let Some(current_chapter) =
                self.extract_number_from_log(log, "Downloading chapter ", "/")
            {
                self.current_chapter = Some(current_chapter);
                debug!(user_id = %self.user_id, current_chapter = current_chapter, "Parsed current chapter");
            }
        }
    }

    fn extract_number_from_log(&self, log: &str, prefix: &str, suffix: &str) -> Option<u32> {
        if let Some(start) = log.find(prefix) {
            let start = start + prefix.len();
            if let Some(end) = log[start..].find(suffix) {
                let number_str = &log[start..start + end];
                if let Ok(number) = number_str.parse::<u32>() {
                    return Some(number);
                }
            }
        }
        None
    }
}

pub type ImportProgressMap = Arc<RwLock<HashMap<Uuid, ImportProgress>>>;

pub struct ImportProgressManager {
    progress_map: ImportProgressMap,
}

impl ImportProgressManager {
    pub fn new() -> Self {
        Self {
            progress_map: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn get_progress_map(&self) -> ImportProgressMap {
        self.progress_map.clone()
    }

    pub async fn start_import(&self, user_id: String, url: String) -> Uuid {
        let import_id = uuid::Uuid::new_v4();
        let progress = ImportProgress::new(import_id, user_id.clone(), url.clone());

        info!(import_id = %import_id, user_id = %user_id, url = %url, "Starting new import");

        {
            let mut map = self.progress_map.write().await;
            map.insert(import_id.clone(), progress);
        }

        import_id
    }

    pub async fn add_log(&self, import_id: &Uuid, log: String) {
        let mut map = self.progress_map.write().await;
        if let Some(progress) = map.get_mut(import_id) {
            progress.add_log(log);
        } else {
            warn!(import_id = %import_id, "Attempted to add log to non-existent import");
        }
    }

    pub async fn update_status(&self, import_id: &Uuid, status: ImportStatus) {
        let mut map = self.progress_map.write().await;
        if let Some(progress) = map.get_mut(import_id) {
            progress.update_status(status);
        } else {
            warn!(import_id = %import_id, "Attempted to update status of non-existent import");
        }
    }

    pub async fn get_progress(&self, import_id: &Uuid) -> Option<ImportProgress> {
        let map = self.progress_map.read().await;
        map.get(import_id).cloned()
    }

    pub async fn get_user_imports(&self, user_id: &str) -> Vec<ImportProgress> {
        let map = self.progress_map.read().await;
        map.values()
            .filter(|progress| progress.user_id == user_id)
            .cloned()
            .collect()
    }

    pub async fn get_import_by_url(&self, user_id: &str, url: &str) -> Option<ImportProgress> {
        let map = self.progress_map.read().await;
        map.values()
            .find(|progress| progress.user_id == user_id && progress.url == url)
            .cloned()
    }

    pub async fn get_all_imports(&self) -> Vec<ImportProgress> {
        let map = self.progress_map.read().await;
        map.values().cloned().collect()
    }

    pub async fn has_active_imports(&self, user_id: &str) -> bool {
        let map = self.progress_map.read().await;
        map.values().any(|progress| {
            progress.user_id == user_id
                && matches!(
                    progress.status,
                    ImportStatus::Starting
                        | ImportStatus::Downloading
                        | ImportStatus::EpubGenerated
                        | ImportStatus::Processing
                        | ImportStatus::Unpacking
                        | ImportStatus::Uploading
                        | ImportStatus::Finalizing
                )
        })
    }

    pub async fn set_process_id(&self, import_id: &Uuid, process_id: u32) {
        let mut map = self.progress_map.write().await;
        if let Some(progress) = map.get_mut(import_id) {
            progress.set_process_id(process_id);
        } else {
            warn!(import_id = %import_id, "Attempted to set process ID for non-existent import");
        }
    }

    pub async fn cancel_import(&self, import_id: &Uuid) -> Result<(), String> {
        let mut map = self.progress_map.write().await;
        if let Some(progress) = map.get_mut(import_id) {
            if let Some(process_id) = progress.process_id {
                // Try to kill the process
                #[cfg(unix)]
                {
                    use std::process::Command;
                    let result = Command::new("kill")
                        .arg("-TERM")
                        .arg(process_id.to_string())
                        .output();

                    match result {
                        Ok(output) => {
                            if output.status.success() {
                                info!(import_id = %import_id, process_id = process_id, "Successfully sent TERM signal to process");
                            } else {
                                warn!(import_id = %import_id, process_id = process_id, "Failed to send TERM signal to process");
                            }
                        }
                        Err(e) => {
                            warn!(import_id = %import_id, process_id = process_id, error = %e, "Failed to execute kill command");
                        }
                    }
                }

                #[cfg(not(unix))]
                {
                    warn!(import_id = %import_id, process_id = process_id, "Process cancellation not supported on this platform");
                }
            }

            progress.update_status(ImportStatus::Cancelled);
            progress.add_log("Import cancelled by user".to_string());
            Ok(())
        } else {
            Err(format!("Import {} not found", import_id))
        }
    }

    pub async fn remove_import(&self, import_id: &Uuid) {
        let mut map = self.progress_map.write().await;
        if map.remove(import_id).is_some() {
            info!(import_id = %import_id, "Removed completed import");
        }
    }

    pub async fn clear_completed_imports(&self, user_id: &str) -> usize {
        let mut map = self.progress_map.write().await;
        let initial_count = map.len();

        map.retain(|import_id, progress| {
            let should_remove = progress.user_id == user_id &&
                matches!(progress.status, ImportStatus::Completed | ImportStatus::Cancelled);

            if should_remove {
                info!(import_id = %import_id, user_id = %user_id, "Removing completed/cancelled import");
            }

            !should_remove
        });

        let removed_count = initial_count - map.len();
        info!(user_id = %user_id, removed_count = removed_count, "Cleared completed/cancelled imports");
        removed_count
    }

    pub async fn cleanup_old_imports(&self) {
        let cutoff = chrono::Utc::now() - chrono::Duration::hours(24);
        let mut map = self.progress_map.write().await;
        let initial_count = map.len();

        map.retain(|_, progress| {
            match progress.status {
                ImportStatus::Completed | ImportStatus::Failed(_) => progress.updated_at > cutoff,
                _ => true, // Keep active imports
            }
        });

        let removed_count = initial_count - map.len();
        if removed_count > 0 {
            info!(
                removed_count = removed_count,
                "Cleaned up old completed imports"
            );
        }
    }
}

impl Default for ImportProgressManager {
    fn default() -> Self {
        Self::new()
    }
}
