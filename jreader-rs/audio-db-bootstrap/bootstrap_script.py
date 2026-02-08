#!/usr/bin/env python3
"""
Bootstrap script for local-audio-yomichan database
This script is called from Rust to initialize the database with custom paths.
"""

import os
import sys
import sqlite3
from pathlib import Path

# Add the local-audio-yomichan directory to the path
local_audio_path = Path(__file__).parent.parent.parent / "local-audio-yomichan"
sys.path.insert(0, str(local_audio_path))

# Set environment variable to run without Anki
os.environ["WO_ANKI"] = "1"

def bootstrap_database(audio_files_path, db_output_path, config_path=None):
    """
    Bootstrap the local-audio-yomichan database
    
    Args:
        audio_files_path: Path to the directory containing audio files
        db_output_path: Path where the SQLite database should be created
        config_path: Optional path to a custom config.json file
    """
    print(f"Bootstrapping database...")
    print(f"Audio files path: {audio_files_path}")
    print(f"Database output path: {db_output_path}")
    if config_path:
        print(f"Config path: {config_path}")
    
    # Import the required modules
    import plugin.util as util
    import plugin.config as config
    import plugin.db_utils as db_utils

    # Override the utility functions to use our custom paths
    def custom_get_data_dir():
        return Path(audio_files_path)

    def custom_get_db_file():
        return Path(db_output_path)

    def custom_get_config_file():
        if config_path:
            return Path(config_path)
        # Return a default config file path that doesn't exist to avoid issues
        return Path("/tmp/nonexistent_config.json")

    def custom_get_default_config_file():
        if config_path:
            return Path(config_path)
        # Return a default config file path that doesn't exist to avoid issues
        return Path("/tmp/nonexistent_default_config.json")

    def custom_get_version_file():
        # Return the version file from the local-audio-yomichan directory
        return Path(__file__).parent.parent.parent / "local-audio-yomichan" / "plugin" / "version.txt"

    # Replace the functions in util and config
    util.get_data_dir = custom_get_data_dir
    util.get_db_file = custom_get_db_file
    util.get_version_file = custom_get_version_file
    config.get_config_file = custom_get_config_file
    config.get_default_config_file = custom_get_default_config_file

    # IMPORTANT: db_utils imported these as symbols; override there too
    db_utils.get_data_dir = custom_get_data_dir
    db_utils.get_db_file = custom_get_db_file
    db_utils.get_version_file = custom_get_version_file

    # If you want to skip version file writes entirely, noop this
    db_utils.update_db_version = lambda: None

    # Debug: print the paths to verify our overrides are working
    print(f"Debug - util.get_data_dir(): {util.get_data_dir()}")
    print(f"Debug - util.get_db_file(): {util.get_db_file()}")
    print(f"Debug - util.get_version_file(): {util.get_version_file()}")
    print(f"Debug - db_utils.get_data_dir(): {db_utils.get_data_dir()}")
    print(f"Debug - db_utils.get_db_file(): {db_utils.get_db_file()}")
    print(f"Debug - db_utils.get_version_file(): {db_utils.get_version_file()}")

    try:
        # Initialize the database
        db_utils.init_db()
        print("✅ Database initialized successfully!")
        return True
    except Exception as e:
        print(f"❌ Failed to initialize database: {e}")
        return False
    finally:
        # No need to restore functions since we're not keeping references to originals
        pass

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python bootstrap_script.py <audio_files_path> <db_output_path> [config_path]")
        sys.exit(1)
    
    audio_files_path = sys.argv[1]
    db_output_path = sys.argv[2]
    config_path = sys.argv[3] if len(sys.argv) > 3 else None
    
    success = bootstrap_database(audio_files_path, db_output_path, config_path)
    sys.exit(0 if success else 1)
