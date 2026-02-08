use std::marker::PhantomData;
use std::os::unix::fs::PermissionsExt;
use std::sync::{Arc, Mutex};

use anyhow::Result;
use camino::{Utf8Path as Path, Utf8PathBuf as PathBuf};
use rusqlite::OpenFlags;
use tracing::{debug, trace};

use crate::kv_store::utils::CreateTaskParams;
use crate::NormalizedPathBuf;

use super::utils::{ProgressGroupId, ProgressStateTable, ProgressTaskType};
use super::{GroupedJSON, IsYomitanSchema};

pub struct DictionaryDB<SchemaType>
where
    SchemaType: IsYomitanSchema,
{
    path: PathBuf,
    conn: Mutex<rusqlite::Connection>,
    schema_type: PhantomData<SchemaType>,
}

fn convert_path_to_uri(path: &Path) -> Result<String> {
    let uri_path = format!(
        "file:{}",
        path.as_os_str().to_str().ok_or_else(|| {
            anyhow::anyhow!(format!("Path contains invalid UTF-8: {:?}", path))
        })?
    );
    Ok(uri_path)
}

// TODO: Use typestate pattern
impl<SchemaType> DictionaryDB<SchemaType>
where
    SchemaType: IsYomitanSchema + Send + 'static,
{
    pub fn new(normalized_path: NormalizedPathBuf) -> Result<Self> {
        let prefix = SchemaType::get_schema_prefix();

        let path = normalized_path.path.join(format!("{prefix}dict.db"));
        debug!("Creating dictionary DB with path: {:?}", path);

        // Verify parent directory exists and check permissions
        let parent = path
            .parent()
            .ok_or_else(|| anyhow::anyhow!("Invalid path - no parent directory: {:?}", path))?;

        if !parent.exists() {
            return Err(anyhow::anyhow!(
                "Parent directory does not exist: {:?}",
                parent
            ));
        }

        // Check directory permissions
        let metadata = std::fs::metadata(parent).map_err(|e| {
            anyhow::anyhow!("Failed to get metadata for directory {:?}: {}", parent, e)
        })?;

        if !metadata.is_dir() {
            return Err(anyhow::anyhow!("Path is not a directory: {:?}", parent));
        }

        let perms = metadata.permissions();
        debug!("Directory permissions: {:?}", perms);

        #[cfg(unix)]
        if perms.mode() & 0o200 == 0 {
            return Err(anyhow::anyhow!(
                "Directory is not writable: {:?} (mode: {:o})",
                parent,
                perms.mode()
            ));
        }

        let conn = rusqlite::Connection::open(&path)
            .map_err(|e| anyhow::anyhow!("Failed to open database at {path:?}: {e}"))?;
        debug!("Created SQLite connection successfully");

        conn.execute("PRAGMA page_size = 4096", [])?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS term_entry (
                id    INTEGER PRIMARY KEY,
                key  TEXT NOT NULL,
                json  BLOB
            )",
            [],
        )?;
        debug!("Created table term_entry for path: {:?}", path);

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_term_key ON term_entry(key);",
            [],
        )?;
        debug!("Created index idx_term_key for path: {:?}", path);

        Ok(Self {
            path,
            conn: Mutex::new(conn),
            schema_type: PhantomData,
        })
    }

    pub fn open_ro(dir_path: &Path) -> Result<Option<Self>> {
        let prefix = SchemaType::get_schema_prefix();
        let path = dir_path.join(format!("{prefix}dict.db"));
        if !path.exists() {
            return Ok(None);
        }

        let conn = rusqlite::Connection::open_with_flags(
            &path,
            OpenFlags::SQLITE_OPEN_READ_ONLY
                | OpenFlags::SQLITE_OPEN_URI
                | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )?;

        Ok(Some(Self {
            path,
            conn: Mutex::new(conn),
            schema_type: PhantomData,
        }))
    }

    fn insert(&self, key: &str, value: &str) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire connection lock: {e}"))?;
        conn.execute(
            "INSERT INTO term_entry (key, json) VALUES (?1, ?2)",
            (key, value),
        )?;
        Ok(())
    }

    pub fn insert_all(
        &self,
        grouped_json: &GroupedJSON,
        progress_state: Arc<ProgressStateTable>,
        dictionary_title: String,
        dictionary_revision: String,
        group_id: ProgressGroupId,
    ) -> Result<()> {
        let params = CreateTaskParams {
            task_type: ProgressTaskType::DbInsertAll,
            dictionary_title: dictionary_title.clone(),
            dictionary_revision,
            schema_name: Some(SchemaType::get_schema_name().to_string()),
            total: grouped_json.0.values().len() as i64,
        };
        debug!("Creating task {:?}", params);
        let task_id = progress_state.create_task(params, group_id)?;

        let mut conn = self
            .conn
            .lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire connection lock: {e}"))?;
        let tx = conn.transaction()?;

        const BATCH_SIZE: usize = 1000;
        let mut batch: Vec<(&str, String)> = Vec::with_capacity(BATCH_SIZE);
        let mut total_processed = 0;

        // Flatten the grouped_json structure into a single iterator over (key, json)
        for (key, json_list) in grouped_json.0.iter() {
            let json_string = serde_json::to_string(&json_list)?;
            batch.push((key.as_str(), json_string));

            // Execute the batch when it reaches the specified size
            if batch.len() >= BATCH_SIZE {
                insert_batch(&tx, &batch)?;
                progress_state.increment(&task_id, batch.len() as i64)?;
                total_processed += batch.len();
                batch.clear();
            }
        }

        // Insert any remaining items in the batch
        if !batch.is_empty() {
            insert_batch(&tx, &batch)?;
            progress_state.increment(&task_id, batch.len() as i64)?;
            total_processed += batch.len();
        }

        tx.commit()?;
        debug!(
            "Inserted {} entries successfully for: {:?}",
            total_processed, dictionary_title
        );
        Ok(())
    }

    pub fn get(&self, key: &str) -> Result<Option<String>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire connection lock: {e}"))?;
        let mut stmt = conn.prepare("SELECT json FROM term_entry WHERE key = ?")?;
        let mut term_iter = stmt.query_map([key], |row| row.get::<_, String>(0))?;
        if let Some(term) = term_iter.next() {
            trace!("🔍 Found term for key: {key}, path: {:?}", self.path);
            Ok(Some(term.unwrap()))
        } else {
            trace!("🔍 No term found for key: {key}, path: {:?}", self.path);
            Ok(None)
        }
    }

    pub fn get_first_row(&self) -> Result<Option<String>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire connection lock: {e}"))?;
        let mut stmt = conn.prepare("SELECT json FROM term_entry LIMIT 1")?;
        let mut rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        Ok(rows.next().transpose()?)
    }

    pub fn get_num_rows(&self) -> Result<i64> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire connection lock: {e}"))?;
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM term_entry")?;
        let mut rows = stmt.query_map([], |row| row.get::<_, i64>(0))?;
        Ok(rows.next().transpose()?.unwrap_or(0))
    }
}

// Add these unsafe implementations - safe because:
// 1. Server only uses read-only connections with SQLITE_OPEN_NO_MUTEX
// 2. Write operations only happen during dictionary generation (separate binary)
unsafe impl<T: IsYomitanSchema> Send for DictionaryDB<T> {}
unsafe impl<T: IsYomitanSchema> Sync for DictionaryDB<T> {}

// Helper function to insert a batch of rows
fn insert_batch(tx: &rusqlite::Transaction, batch: &[(&str, String)]) -> Result<()> {
    let placeholders: String = batch
        .iter()
        .map(|_| "(?, ?)")
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!("INSERT INTO term_entry (key, json) VALUES {}", placeholders);

    let params: Vec<&dyn rusqlite::ToSql> = batch
        .iter()
        .flat_map(|(key, json)| vec![key as &dyn rusqlite::ToSql, json as &dyn rusqlite::ToSql])
        .collect();

    let mut stmt = tx.prepare(&sql)?;
    stmt.execute(params.as_slice())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use uuid::Uuid;

    use crate::json_schema::tag_bank_v3::TagBankV3;
    use crate::json_schema::term_bank_v3::TermBankV3;
    use crate::json_schema::term_meta_bank_v3::TermMetaBankV3;

    use super::*;

    #[test]
    fn test_insert_and_get() {
        let temp_dir = tempfile::tempdir().unwrap();
        let temp_dir = NormalizedPathBuf::new(Path::from_path(temp_dir.path()).unwrap());

        let db: DictionaryDB<TermBankV3> = DictionaryDB::new(temp_dir).unwrap();
        db.insert("打", "{}").unwrap();
        let term = db.get("打").unwrap().unwrap();
        assert_eq!(term, "{}");
    }

    #[test]
    fn test_query_with_no_results() {
        let temp_dir = tempfile::tempdir().unwrap();
        let temp_dir = NormalizedPathBuf::new(Path::from_path(temp_dir.path()).unwrap());

        let db: DictionaryDB<TermBankV3> = DictionaryDB::new(temp_dir).unwrap();
        let term = db.get("打").unwrap();
        assert_eq!(term, None);
    }

    #[tokio::test]
    async fn test_create_db_from_json_term_bank() {
        let progress_state = Arc::new(ProgressStateTable::new(None).unwrap());
        let temp_dir = tempfile::tempdir().unwrap();
        let temp_dir = NormalizedPathBuf::new(Path::from_path(temp_dir.path()).unwrap());

        let grouped_json = GroupedJSON::new(vec![Path::new(
            "data/dictionaries/valid-dictionary1/term_bank_1.json",
        )])
        .unwrap();
        let db: DictionaryDB<TermBankV3> = DictionaryDB::new(temp_dir).unwrap();
        let group_id = ProgressGroupId(Uuid::new_v4());
        db.insert_all(
            &grouped_json,
            progress_state.clone(),
            "Test Dictionary".to_string(),
            "1.0".to_string(),
            group_id,
        )
        .unwrap();

        let json_string = db.get("打").unwrap().unwrap();
        let json: Vec<serde_json::Value> = serde_json::from_str(&json_string).unwrap();

        #[rustfmt::skip]
        assert_eq!(json, vec![json!(["打", "だ", "n", "n", 1, ["da definition 1", "da definition 2"], 1, "E1"]), json!(["打", "ダース", "n abbr", "n", 1, ["daasu definition 1", "daasu definition 2"], 2, "E1"])]);
    }

    #[tokio::test]
    async fn test_create_db_from_json_tag_bank() {
        let progress_state = Arc::new(ProgressStateTable::new(None).unwrap());
        let grouped_json = GroupedJSON::new(vec![Path::new(
            "data/dictionaries/valid-dictionary1/tag_bank_1.json",
        )])
        .unwrap();
        let temp_dir = tempfile::tempdir().unwrap();
        let temp_dir = NormalizedPathBuf::new(Path::from_path(temp_dir.path()).unwrap());

        let db: DictionaryDB<TagBankV3> = DictionaryDB::new(temp_dir).unwrap();
        let group_id = ProgressGroupId(Uuid::new_v4());
        db.insert_all(
            &grouped_json,
            progress_state.clone(),
            "Test Dictionary".to_string(),
            "1.0".to_string(),
            group_id,
        )
        .unwrap();

        let json_string = db.get("E1").unwrap().unwrap();
        let json: Vec<serde_json::Value> = serde_json::from_str(&json_string).unwrap();

        #[rustfmt::skip]
        assert_eq!(json, vec![json!(["E1", "default", 0, "example tag 1", 0])]);
    }

    #[tokio::test]
    async fn test_create_db_from_json_term_meta_bank() {
        let progress_state = Arc::new(ProgressStateTable::new(None).unwrap());
        let grouped_json = GroupedJSON::new(vec![Path::new(
            "data/dictionaries/valid-dictionary1/term_meta_bank_1.json",
        )])
        .unwrap();
        let temp_dir = tempfile::tempdir().unwrap();
        let temp_dir = NormalizedPathBuf::new(Path::from_path(temp_dir.path()).unwrap());

        let db: DictionaryDB<TermMetaBankV3> = DictionaryDB::new(temp_dir).unwrap();
        let group_id = ProgressGroupId(Uuid::new_v4());
        db.insert_all(
            &grouped_json,
            progress_state.clone(),
            "Test Dictionary".to_string(),
            "1.0".to_string(),
            group_id,
        )
        .unwrap();

        let json_string = db.get("打").unwrap().unwrap();
        let json: Vec<serde_json::Value> = serde_json::from_str(&json_string).unwrap();

        #[rustfmt::skip]
        assert_eq!(json, vec![json!(["打", "freq", 1]), json!(["打", "freq", "four"]), json!(["打", "freq", "five (5)"]), json!(["打", "freq", {"reading": "だ", "frequency": 8}]), json!(["打", "freq", {"reading": "ダース", "frequency": 9}]), json!(["打", "freq", {"reading": "だ", "frequency": "fourteen"}]), json!(["打", "freq", {"reading": "ダース", "frequency": "fifteen"}]), json!(["打", "freq", {"reading": "だ", "frequency": "twenty (20)"}]), json!(["打", "freq", {"reading": "ダース", "frequency": "twenty-one (21)"}]), json!(["打", "freq", {"reading": "だ", "frequency": {"value": 26}}]), json!(["打", "freq", {"reading": "ダース", "frequency": {"value": 27, "displayValue": "twenty-seven"}}])]);
    }
}
