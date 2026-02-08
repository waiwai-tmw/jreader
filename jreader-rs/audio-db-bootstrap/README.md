# Audio Database Bootstrap

This tool bootstraps a SQLite database for local-audio-yomichan by calling a Python script, without requiring Anki to be running.

## Prerequisites

1. **Python Environment**: Make sure you have Python 3.7+ installed
2. **local-audio-yomichan**: The local-audio-yomichan repository must be cloned in the parent directory (`../local-audio-yomichan`)
3. **Audio Files**: You need the audio files from local-audio-yomichan (downloaded separately)
4. **SQLite3**: For database verification (usually pre-installed on macOS/Linux)

## Quick Start

The easiest way to bootstrap the database is using the provided wrapper script:

```bash
# Bootstrap the database
./bootstrap-audio-db.sh ~/Downloads/local-yomichan-audio-collection-2023-06-11-opus/user_files

# Verify the database contents
./verify-audio-db.sh entries.db
```

## Installation

1. Make sure you're in the jreader-rs directory
2. Build the tool:
   ```bash
   cargo build --release -p audio-db-bootstrap
   ```

## Usage

### Simple Usage (Recommended)

Use the wrapper script for the easiest experience:

```bash
# Basic usage - creates entries.db in current directory
./bootstrap-audio-db.sh ~/Downloads/local-yomichan-audio-collection-2023-06-11-opus/user_files

# Specify custom output path
./bootstrap-audio-db.sh ~/Downloads/local-yomichan-audio-collection-2023-06-11-opus/user_files my_audio.db

# With custom config file
./bootstrap-audio-db.sh ~/Downloads/local-yomichan-audio-collection-2023-06-11-opus/user_files my_audio.db custom_config.json
```

### Direct Usage

If you prefer to use the binary directly:

```bash
# Basic usage
./target/release/audio-db-bootstrap -a /path/to/audio/files -o entries.db

# With custom config and verbose output
./target/release/audio-db-bootstrap \
  -a /path/to/audio/files \
  -o /path/to/output/entries.db \
  -c /path/to/custom/config.json \
  -v
```

### Command Line Options

- `-a, --audio-files <PATH>`: Path to the directory containing audio files (required)
- `-o, --output <PATH>`: Path where the SQLite database should be created (default: entries.db)
- `-c, --config <PATH>`: Optional path to a custom config.json file
- `-v, --verbose`: Enable verbose output
- `-h, --help`: Show help information

## Audio Files Structure

The audio files should be organized according to the local-audio-yomichan structure:

```
audio_files/
├── nhk16_files/
├── shinmeikai8_files/
├── forvo_files/
├── jpod_files/
├── jpod_alternate_files/
└── ozk5_files/
```

## Configuration

The tool uses the default configuration from local-audio-yomichan, but you can provide a custom config.json file. An example configuration is provided in `example-config.json` that you can copy and modify. The config should follow the same format as the default config:

```json
{
  "sources": [
    {
      "type": "nhk",
      "id": "nhk16",
      "path": "nhk16_files",
      "display": "NHK16 %s"
    },
    {
      "type": "ajt_jp",
      "id": "shinmeikai8",
      "path": "shinmeikai8_files",
      "display": "SMK8 %s"
    }
  ]
}
```

## Database Schema

The generated SQLite database contains an `entries` table with the following columns:

- `id`: Primary key
- `expression`: The Japanese term (kanji)
- `reading`: The reading (kana)
- `source`: Audio source identifier
- `speaker`: Speaker information (for Forvo)
- `display`: Display text
- `file`: Path to the audio file

## Verification

After creating the database, you can verify its contents using the verification script:

```bash
# Verify the default database
./verify-audio-db.sh

# Verify a specific database
./verify-audio-db.sh my_audio.db
```

The verification script will show:
- Database statistics (total entries, unique expressions, etc.)
- Breakdown by audio source
- Sample entries
- Audio file types
- Database schema

## Troubleshooting

### Common Issues

1. **local-audio-yomichan not found**: Make sure the repository is cloned at `../local-audio-yomichan`
2. **Missing Audio Files**: Ensure the audio files directory exists and contains the expected subdirectories
3. **Permission Errors**: Make sure you have write permissions for the output directory
4. **Python Import Errors**: Make sure Python 3.7+ is installed and accessible

### Debug Mode

Run with verbose output to see detailed information:

```bash
./target/release/audio-db-bootstrap -a /path/to/audio/files -o entries.db -v
```

## Integration with jreader

This tool is designed to be used as part of the jreader project to bootstrap the audio database that can then be used by the main application. The generated database can be placed in a location accessible by the jreader service.

## Architecture

The tool uses a simple architecture:
- **Rust binary** (`audio-db-bootstrap`): Handles command-line arguments and calls the Python script
- **Python script** (`bootstrap_script.py`): Does the actual database initialization using local-audio-yomichan code
- **Wrapper scripts**: Provide convenient interfaces for common use cases

This approach avoids the complexity of PyO3 while still leveraging the existing local-audio-yomichan Python codebase.
