use anyhow::{Context, Result};
use clap::Parser;
use std::path::PathBuf;
use tracing::{error, info};

#[derive(Parser)]
#[command(name = "audio-db-bootstrap")]
#[command(about = "Bootstrap local-audio-yomichan SQLite database")]
struct Args {
    /// Path to the directory containing audio files
    #[arg(short, long)]
    audio_files: PathBuf,

    /// Path where the SQLite database should be created
    #[arg(short, long, default_value = "entries.db")]
    output: PathBuf,

    /// Optional path to a custom config.json file
    #[arg(short, long)]
    config: Option<PathBuf>,

    /// Verbose output
    #[arg(short, long)]
    verbose: bool,
}

fn main() -> Result<()> {
    let args = Args::parse();

    // Initialize tracing
    let level = if args.verbose { "debug" } else { "info" };

    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| level.to_string()),
        ))
        .init();

    info!("Starting audio database bootstrap...");
    info!("Audio files path: {}", args.audio_files.display());
    info!("Database output path: {}", args.output.display());
    if let Some(config_path) = &args.config {
        info!("Custom config path: {}", config_path.display());
    }

    // Validate input paths
    if !args.audio_files.exists() {
        anyhow::bail!(
            "Audio files directory does not exist: {}",
            args.audio_files.display()
        );
    }

    if !args.audio_files.is_dir() {
        anyhow::bail!(
            "Audio files path is not a directory: {}",
            args.audio_files.display()
        );
    }

    // Create output directory if it doesn't exist
    if let Some(parent) = args.output.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).context("Failed to create output directory")?;
        }
    }

    // Bootstrap the database
    match audio_db_bootstrap::bootstrap_audio_database(
        &args.audio_files,
        &args.output,
        args.config.as_deref(),
    ) {
        Ok(()) => {
            info!(
                "✅ Successfully created audio database at: {}",
                args.output.display()
            );
            Ok(())
        }
        Err(e) => {
            error!("❌ Failed to create audio database: {}", e);
            Err(e)
        }
    }
}
