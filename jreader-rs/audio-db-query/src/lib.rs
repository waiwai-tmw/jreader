use anyhow::Result;
use camino::{Utf8Path as Path, Utf8PathBuf as PathBuf};
use rusqlite::{Connection, OpenFlags, Row};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// Audio database entry representing a row from the entries table
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioEntry {
    pub id: i64,
    pub expression: String,
    pub reading: Option<String>,
    pub source: String,
    pub speaker: Option<String>,
    pub display: Option<String>,
    pub file: String,
}

/// Audio database query interface
pub struct AudioDB {
    path: PathBuf,
    conn: Mutex<Connection>,
}

impl AudioDB {
    /// Create a new AudioDB instance from a database file path (read-only)
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path = path.as_ref().to_path_buf();
        let conn = Connection::open_with_flags(
            &path,
            OpenFlags::SQLITE_OPEN_READ_ONLY
                | OpenFlags::SQLITE_OPEN_NO_MUTEX
                | OpenFlags::SQLITE_OPEN_URI,
        )?;

        Ok(Self {
            path,
            conn: Mutex::new(conn),
        })
    }

    /// Query for audio entries by expression and reading
    pub fn query_by_term_and_reading(
        &self,
        expression: &str,
        reading: &str,
    ) -> Result<Vec<AudioEntry>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire connection lock: {e}"))?;

        let mut stmt = conn.prepare(
            "SELECT id, expression, reading, source, speaker, display, file 
             FROM entries 
             WHERE expression = ? AND reading = ?
             ORDER BY source, speaker, display",
        )?;

        let rows = stmt.query_map([expression, reading], |row| self.row_to_audio_entry(row))?;

        let mut entries = Vec::new();
        for row in rows {
            let entry = row.map_err(|e| anyhow::anyhow!("Database error: {}", e))?;
            entries.push(entry);
        }

        Ok(entries)
    }

    /// Query for audio entries by expression only (reading can be null)
    pub fn query_by_term(&self, expression: &str) -> Result<Vec<AudioEntry>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire connection lock: {e}"))?;

        let mut stmt = conn.prepare(
            "SELECT id, expression, reading, source, speaker, display, file 
             FROM entries 
             WHERE expression = ?
             ORDER BY source, speaker, display",
        )?;

        let rows = stmt.query_map([expression], |row| self.row_to_audio_entry(row))?;

        let mut entries = Vec::new();
        for row in rows {
            let entry = row.map_err(|e| anyhow::anyhow!("Database error: {}", e))?;
            entries.push(entry);
        }

        Ok(entries)
    }

    /// Query for audio entries by expression or reading (matches either)
    pub fn query_by_term_or_reading(&self, term: &str) -> Result<Vec<AudioEntry>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire connection lock: {e}"))?;

        let mut stmt = conn.prepare(
            "SELECT id, expression, reading, source, speaker, display, file 
             FROM entries 
             WHERE expression = ? OR reading = ?
             ORDER BY source, speaker, display",
        )?;

        let rows = stmt.query_map([term, term], |row| self.row_to_audio_entry(row))?;

        let mut entries = Vec::new();
        for row in rows {
            let entry = row.map_err(|e| anyhow::anyhow!("Database error: {}", e))?;
            entries.push(entry);
        }

        Ok(entries)
    }

    /// Get statistics about the database
    pub fn get_stats(&self) -> Result<AudioDBStats> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire connection lock: {e}"))?;

        let total_entries: i64 =
            conn.query_row("SELECT COUNT(*) FROM entries", [], |row| row.get(0))?;
        let unique_expressions: i64 = conn.query_row(
            "SELECT COUNT(DISTINCT expression) FROM entries",
            [],
            |row| row.get(0),
        )?;
        let unique_readings: i64 =
            conn.query_row("SELECT COUNT(DISTINCT reading) FROM entries", [], |row| {
                row.get(0)
            })?;

        // Get source breakdown
        let mut source_stats = Vec::new();
        let mut stmt = conn.prepare(
            "SELECT source, COUNT(*) FROM entries GROUP BY source ORDER BY COUNT(*) DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })?;

        for row in rows {
            source_stats.push(row?);
        }

        Ok(AudioDBStats {
            total_entries,
            unique_expressions,
            unique_readings,
            source_stats,
        })
    }

    /// Convert a database row to an AudioEntry
    fn row_to_audio_entry(&self, row: &Row) -> rusqlite::Result<AudioEntry> {
        Ok(AudioEntry {
            id: row.get(0)?,
            expression: row.get(1)?,
            reading: row.get(2)?,
            source: row.get(3)?,
            speaker: row.get(4)?,
            display: row.get(5)?,
            file: row.get(6)?,
        })
    }
}

/// Statistics about the audio database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDBStats {
    pub total_entries: i64,
    pub unique_expressions: i64,
    pub unique_readings: i64,
    pub source_stats: Vec<(String, i64)>,
}

// Safe to implement Send and Sync because we use Mutex for connection access
unsafe impl Send for AudioDB {}
unsafe impl Sync for AudioDB {}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn resolve_db_path() -> Option<PathBuf> {
        // AUDIO_DB_PATH from env has highest priority
        if let Ok(p) = env::var("AUDIO_DB_PATH") {
            let p = PathBuf::from(p);
            if std::path::Path::new(p.as_str()).exists() {
                return Some(p);
            }
        }

        // Try workspace root entries.db (../entries.db from crate dir during tests)
        let candidate = PathBuf::from("../entries.db");
        if std::path::Path::new(candidate.as_str()).exists() {
            return Some(candidate);
        }

        // Try local entries.db
        let candidate = PathBuf::from("entries.db");
        if std::path::Path::new(candidate.as_str()).exists() {
            return Some(candidate);
        }

        None
    }

    #[test]
    fn test_audio_db_creation() {
        if let Some(db_path) = resolve_db_path() {
            let db = AudioDB::new(&db_path);
            assert!(db.is_ok());
            let db = db.unwrap();
            let stats = db.get_stats();
            assert!(stats.is_ok());
            let stats = stats.unwrap();
            if stats.total_entries == 0 {
                eprintln!("Skipping assertions: entries table is empty at {}", db_path);
                return;
            }
            println!("Using DB: {}", db_path);
            println!("Database stats: {:?}", stats);
        } else {
            eprintln!(
                "Skipping test_audio_db_creation: AUDIO_DB_PATH not set and entries.db not found"
            );
        }
    }

    #[test]
    fn test_query_by_term() {
        if let Some(db_path) = resolve_db_path() {
            let db = AudioDB::new(&db_path).unwrap();
            // Check if there is at least one row
            let conn = Connection::open(db_path.as_str()).unwrap();
            let count: i64 = conn
                .query_row("SELECT COUNT(*) FROM entries", [], |r| r.get(0))
                .unwrap_or(0);
            if count == 0 {
                eprintln!(
                    "Skipping test_query_by_term: entries table is empty at {}",
                    db_path
                );
                return;
            }
            // Pull a real expression from DB
            let (expr,): (String,) = conn
                .query_row("SELECT expression FROM entries LIMIT 1", [], |r| {
                    Ok((r.get::<_, String>(0)?,))
                })
                .unwrap();

            let entries = db.query_by_term(&expr);
            assert!(entries.is_ok());
            let entries = entries.unwrap();
            assert!(!entries.is_empty());
        } else {
            eprintln!("Skipping test_query_by_term: no DB path available");
        }
    }

    #[test]
    fn test_query_by_term_and_reading() {
        if let Some(db_path) = resolve_db_path() {
            let db = AudioDB::new(&db_path).unwrap();
            // Pull a real expression + reading from DB where reading is not null
            let conn = Connection::open(db_path.as_str()).unwrap();
            let with_reading: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM entries WHERE reading IS NOT NULL",
                    [],
                    |r| r.get(0),
                )
                .unwrap_or(0);
            if with_reading == 0 {
                eprintln!(
                    "Skipping test_query_by_term_and_reading: no rows with reading in {}",
                    db_path
                );
                return;
            }
            let (expr, reading): (String, String) = conn
                .query_row(
                    "SELECT expression, reading FROM entries WHERE reading IS NOT NULL LIMIT 1",
                    [],
                    |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)),
                )
                .unwrap();

            let entries = db.query_by_term_and_reading(&expr, &reading);
            assert!(entries.is_ok());
            let entries = entries.unwrap();
            assert!(!entries.is_empty());
        } else {
            eprintln!("Skipping test_query_by_term_and_reading: no DB path available");
        }
    }
}
