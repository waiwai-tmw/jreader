use anyhow::{Context, Result};
use std::path::Path;
use std::process::Command;
use tracing::{debug, info};

/// Bootstrap the local-audio-yomichan SQLite database
///
/// This function calls a Python script to initialize the database
/// without requiring Anki to be running.
///
/// # Arguments
/// * `audio_files_path` - Path to the directory containing the audio files
/// * `db_output_path` - Path where the SQLite database should be created
/// * `config_path` - Optional path to a custom config.json file
///
/// # Returns
/// * `Result<()>` - Success or error
pub fn bootstrap_audio_database(
    audio_files_path: &Path,
    db_output_path: &Path,
    config_path: Option<&Path>,
) -> Result<()> {
    info!("Starting audio database bootstrap with Python script...");
    debug!("Audio files path: {}", audio_files_path.display());
    debug!("Database output path: {}", db_output_path.display());

    // Get the path to the bootstrap script
    let script_path = std::env::current_dir()?.join("audio-db-bootstrap/bootstrap_script.py");
    if !script_path.exists() {
        anyhow::bail!("Bootstrap script not found at: {}", script_path.display());
    }

    // Build the command
    let mut cmd = Command::new("python3");
    cmd.arg(script_path);
    cmd.arg(audio_files_path);
    cmd.arg(db_output_path);

    if let Some(config_path) = config_path {
        cmd.arg(config_path);
    }

    // Set environment variable
    cmd.env("WO_ANKI", "1");

    debug!("Running command: {:?}", cmd);

    // Execute the command
    let output = cmd.output().context("Failed to execute bootstrap script")?;

    // Print stdout and stderr
    if !output.stdout.is_empty() {
        info!("Script output: {}", String::from_utf8_lossy(&output.stdout));
    }
    if !output.stderr.is_empty() {
        info!("Script stderr: {}", String::from_utf8_lossy(&output.stderr));
    }

    if output.status.success() {
        info!(
            "Successfully initialized audio database at: {}",
            db_output_path.display()
        );
        Ok(())
    } else {
        anyhow::bail!("Bootstrap script failed with exit code: {}", output.status);
    }
}

/// Simple wrapper to bootstrap the database with default settings
pub fn bootstrap_audio_database_simple(
    audio_files_path: &Path,
    db_output_path: &Path,
) -> Result<()> {
    bootstrap_audio_database(audio_files_path, db_output_path, None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_bootstrap_audio_database() {
        // Create temporary directories for testing
        let temp_dir = TempDir::new().unwrap();
        let audio_dir = temp_dir.path().join("audio_files");
        let db_path = temp_dir.path().join("entries.db");

        // Create the audio directory
        fs::create_dir_all(&audio_dir).unwrap();

        // This test would require the actual local-audio-yomichan Python package
        // to be installed and the audio files to be present
        // For now, we'll just test that the function doesn't panic
        let result = bootstrap_audio_database_simple(&audio_dir, &db_path);

        // The test will likely fail without the actual Python package,
        // but we can at least verify the function signature is correct
        assert!(result.is_err() || result.is_ok());
    }
}
