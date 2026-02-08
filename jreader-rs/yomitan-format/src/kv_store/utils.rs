use anyhow::Result;
use camino::Utf8Path as Path;
use rusqlite::{types::FromSql, Connection};
use std::sync::{Arc, Mutex};
use tokio::time::{sleep, Duration};
use uuid::Uuid;

#[derive(Debug, Clone, Copy)]
pub struct ProgressTaskId(pub Uuid);

#[derive(Debug, Clone, Copy)]
pub struct ProgressGroupId(pub Uuid);

#[derive(Debug, Eq, PartialEq)]
pub enum ProgressTaskType {
    LoadJson,
    MergeJson,
    DbInsertAll,
    CopyStaticAssets,
}

#[derive(Debug)]
pub struct CreateTaskParams {
    pub task_type: ProgressTaskType,
    pub dictionary_title: String,
    pub dictionary_revision: String,
    pub schema_name: Option<String>,
    pub total: i64,
}

impl ToString for ProgressTaskType {
    fn to_string(&self) -> String {
        match self {
            ProgressTaskType::LoadJson => "LoadJson",
            ProgressTaskType::MergeJson => "MergeJson",
            ProgressTaskType::DbInsertAll => "DbInsertAll",
            ProgressTaskType::CopyStaticAssets => "CopyStaticAssets",
        }
        .to_string()
    }
}

impl From<String> for ProgressTaskType {
    fn from(s: String) -> Self {
        match s.as_str() {
            "LoadJson" => ProgressTaskType::LoadJson,
            "MergeJson" => ProgressTaskType::MergeJson,
            "DbInsertAll" => ProgressTaskType::DbInsertAll,
            "CopyStaticAssets" => ProgressTaskType::CopyStaticAssets,
            _ => panic!("Invalid ProgressTaskType: {}", s),
        }
    }
}

#[derive(Debug)]
pub struct ProgressData {
    pub task_id: ProgressTaskId,
    pub group_id: ProgressGroupId,
    pub task_type: ProgressTaskType,
    pub dictionary_title: String,
    pub dictionary_revision: String,
    pub schema_name: String,
    pub current: i64,
    pub total: i64,
}

#[derive(Clone)]
pub struct ProgressStateTable {
    conn: Arc<Mutex<Connection>>,
}

impl ProgressStateTable {
    pub fn new(path: Option<&Path>) -> Result<Self> {
        let conn = if let Some(path) = path {
            Connection::open(path)?
        } else {
            Connection::open_in_memory()?
        };

        // Drop and recreate the table
        // conn.execute("DROP TABLE IF EXISTS progress", [])?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS progress (
                task_id TEXT PRIMARY KEY,
                group_id TEXT NOT NULL,
                task_type TEXT NOT NULL,
                dictionary_title TEXT NOT NULL,
                dictionary_revision TEXT NOT NULL,
                schema_name TEXT NOT NULL,
                current INTEGER NOT NULL DEFAULT 0,
                total INTEGER NOT NULL DEFAULT 0
            )",
            [],
        )?;
        // Clear the table
        conn.execute("DELETE FROM progress", [])?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn create_task(
        &self,
        params: CreateTaskParams,
        group_id: ProgressGroupId,
    ) -> Result<ProgressTaskId> {
        let task_id = Uuid::new_v4();
        let conn = self
            .conn
            .lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire connection lock: {e}"))?;

        conn.execute(
            "INSERT INTO progress (task_id, group_id, task_type, dictionary_title, dictionary_revision, schema_name, current, total)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            (
                task_id.to_string(),
                group_id.0.to_string(),
                params.task_type.to_string(),
                params.dictionary_title,
                params.dictionary_revision,
                params.schema_name.unwrap_or_default(),
                0,
                params.total,
            ),
        )?;

        Ok(ProgressTaskId(task_id))
    }

    pub fn increment(&self, task_id: &ProgressTaskId, amount: i64) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire connection lock: {e}"))?;
        conn.execute(
            "UPDATE progress 
             SET current = current + ?1 
             WHERE task_id = ?2",
            (amount, task_id.0.to_string()),
        )?;
        Ok(())
    }

    pub fn get_progress(&self, task_id: &ProgressTaskId) -> Result<ProgressData> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire connection lock: {e}"))?;
        Ok(conn.query_row(
            "SELECT task_id, group_id, task_type, dictionary_title, dictionary_revision, schema_name, current, total 
             FROM progress WHERE task_id = ?1",
            [task_id.0.to_string()],
            |row| Ok(ProgressData {
                task_id: ProgressTaskId(Uuid::parse_str(&row.get::<_, String>(0)?).unwrap()),
                group_id: ProgressGroupId(Uuid::parse_str(&row.get::<_, String>(1)?).unwrap()),
                task_type: row.get::<_, String>(2)?.into(),
                dictionary_title: row.get(3)?,
                dictionary_revision: row.get(4)?,
                schema_name: row.get(5)?,
                current: row.get(6)?,
                total: row.get(7)?,
            }),
        )?)
    }

    pub fn get_all_tasks(&self) -> Result<Vec<ProgressData>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire connection lock: {e}"))?;
        let mut stmt = conn.prepare(
            "SELECT task_id, group_id, task_type, dictionary_title, dictionary_revision, schema_name, current, total 
             FROM progress"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(ProgressData {
                task_id: ProgressTaskId(Uuid::parse_str(&row.get::<_, String>(0)?).unwrap()),
                group_id: ProgressGroupId(Uuid::parse_str(&row.get::<_, String>(1)?).unwrap()),
                task_type: row.get::<_, String>(2)?.into(),
                dictionary_title: row.get(3)?,
                dictionary_revision: row.get(4)?,
                schema_name: row.get(5)?,
                current: row.get(6)?,
                total: row.get(7)?,
            })
        })?;

        let tasks = rows
            .map(|r| r.map_err(anyhow::Error::from))
            .collect::<Result<Vec<_>>>()?;
        Ok(tasks)
    }

    pub fn is_task_complete(&self, task_id: &ProgressTaskId) -> Result<bool> {
        let data = self.get_progress(task_id)?;
        Ok(data.current == data.total && data.total > 0)
    }

    pub async fn wait_for_completion(
        &self,
        task_id: &ProgressTaskId,
        timeout_secs: u64,
    ) -> Result<bool> {
        let start = std::time::Instant::now();
        let timeout = Duration::from_secs(timeout_secs);

        while !self.is_task_complete(task_id)? {
            if start.elapsed() > timeout {
                return Ok(false);
            }
            sleep(Duration::from_millis(100)).await;
        }
        Ok(true)
    }
}

impl FromSql for ProgressTaskType {
    fn column_result(value: rusqlite::types::ValueRef<'_>) -> rusqlite::types::FromSqlResult<Self> {
        let text = String::column_result(value)?;
        match text.as_str() {
            "LoadJson" => Ok(ProgressTaskType::LoadJson),
            "MergeJson" => Ok(ProgressTaskType::MergeJson),
            "DbInsertAll" => Ok(ProgressTaskType::DbInsertAll),
            _ => Err(rusqlite::types::FromSqlError::InvalidType),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{sync::Arc, time::Duration};

    #[test]
    fn test_create_and_get_task() -> Result<()> {
        let group_id = ProgressGroupId(Uuid::new_v4());
        let table = ProgressStateTable::new(None)?;
        let task_id = table.create_task(
            CreateTaskParams {
                task_type: ProgressTaskType::MergeJson,
                dictionary_title: "Test Dict".to_string(),
                dictionary_revision: "1.0".to_string(),
                schema_name: Some("schema1".to_string()),
                total: 100,
            },
            group_id,
        )?;

        let progress = table.get_progress(&task_id)?;
        assert_eq!(progress.dictionary_title, "Test Dict");
        assert_eq!(progress.dictionary_revision, "1.0");
        assert_eq!(progress.schema_name, "schema1");
        assert_eq!(progress.current, 0);
        assert_eq!(progress.total, 100);

        Ok(())
    }

    #[test]
    fn test_increment_progress() -> Result<()> {
        let group_id = ProgressGroupId(Uuid::new_v4());
        let table = ProgressStateTable::new(None)?;
        let task_id = table.create_task(
            CreateTaskParams {
                task_type: ProgressTaskType::DbInsertAll,
                dictionary_title: "Test Dict".to_string(),
                dictionary_revision: "1.0".to_string(),
                schema_name: None,
                total: 100,
            },
            group_id,
        )?;

        table.increment(&task_id, 50)?;
        let progress = table.get_progress(&task_id)?;
        assert_eq!(progress.current, 50);

        table.increment(&task_id, 50)?;
        let progress = table.get_progress(&task_id)?;
        assert_eq!(progress.current, 100);

        Ok(())
    }

    #[test]
    fn test_get_all_tasks() -> Result<()> {
        let group_id = ProgressGroupId(Uuid::new_v4());
        let table = ProgressStateTable::new(None)?;

        let task1 = table.create_task(
            CreateTaskParams {
                task_type: ProgressTaskType::MergeJson,
                dictionary_title: "Dict1".to_string(),
                dictionary_revision: "1.0".to_string(),
                schema_name: None,
                total: 100,
            },
            group_id,
        )?;

        let task2 = table.create_task(
            CreateTaskParams {
                task_type: ProgressTaskType::DbInsertAll,
                dictionary_title: "Dict2".to_string(),
                dictionary_revision: "2.0".to_string(),
                schema_name: Some("schema2".to_string()),
                total: 200,
            },
            group_id,
        )?;

        let tasks = table.get_all_tasks()?;
        assert_eq!(tasks.len(), 2);
        assert_eq!(tasks[0].dictionary_title, "Dict1");
        assert_eq!(tasks[1].dictionary_title, "Dict2");

        Ok(())
    }

    #[test]
    fn test_is_task_complete() -> Result<()> {
        let group_id = ProgressGroupId(Uuid::new_v4());
        let table = ProgressStateTable::new(None)?;
        let task_id = table.create_task(
            CreateTaskParams {
                task_type: ProgressTaskType::DbInsertAll,
                dictionary_title: "Test Dict".to_string(),
                dictionary_revision: "1.0".to_string(),
                schema_name: None,
                total: 100,
            },
            group_id,
        )?;

        assert!(!table.is_task_complete(&task_id)?);

        table.increment(&task_id, 100)?;
        assert!(table.is_task_complete(&task_id)?);

        Ok(())
    }

    #[tokio::test]
    async fn test_wait_for_completion() -> Result<()> {
        let group_id = ProgressGroupId(Uuid::new_v4());
        let table = ProgressStateTable::new(None)?;
        let task_id = table.create_task(
            CreateTaskParams {
                task_type: ProgressTaskType::DbInsertAll,
                dictionary_title: "Test Dict".to_string(),
                dictionary_revision: "1.0".to_string(),
                schema_name: None,
                total: 100,
            },
            group_id,
        )?;

        // Spawn a task to increment progress after a delay
        let table_clone = table.clone();
        let task_id_clone = task_id;
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(500)).await;
            table_clone.increment(&task_id_clone, 100).unwrap();
        });

        // Wait for completion with timeout
        let completed = table.wait_for_completion(&task_id, 2).await?;
        assert!(completed);

        // Test timeout
        let task_id2 = table.create_task(
            CreateTaskParams {
                task_type: ProgressTaskType::DbInsertAll,
                dictionary_title: "Test Dict 2".to_string(),
                dictionary_revision: "1.0".to_string(),
                schema_name: None,
                total: 100,
            },
            group_id,
        )?;
        let completed = table.wait_for_completion(&task_id2, 1).await?;
        assert!(!completed);

        Ok(())
    }

    #[tokio::test]
    async fn test_concurrent_task_creation() -> Result<()> {
        let group_id = ProgressGroupId(Uuid::new_v4());
        let table = Arc::new(ProgressStateTable::new(None)?);
        let mut handles = vec![];

        // Spawn 10 concurrent tasks
        for i in 0..10 {
            let table = table.clone();
            let group_id = group_id;

            let handle = tokio::spawn(async move {
                let task_id = table.create_task(
                    CreateTaskParams {
                        task_type: ProgressTaskType::DbInsertAll,
                        dictionary_title: format!("Dict{}", i),
                        dictionary_revision: "1.0".to_string(),
                        schema_name: None,
                        total: 100,
                    },
                    group_id,
                )?;

                // Increment the progress a few times
                table.increment(&task_id, 30)?;
                table.increment(&task_id, 40)?;
                table.increment(&task_id, 30)?;

                Result::<_>::Ok(task_id)
            });
            handles.push(handle);
        }

        // Wait for all tasks to complete
        for handle in handles {
            handle.await??;
        }

        // Verify results
        let tasks = table.get_all_tasks()?;
        assert_eq!(tasks.len(), 10);

        // Verify each task completed successfully
        for task in tasks {
            assert_eq!(task.current, 100);
            assert_eq!(task.total, 100);
            assert!(task.dictionary_title.starts_with("Dict"));
        }

        Ok(())
    }
}
