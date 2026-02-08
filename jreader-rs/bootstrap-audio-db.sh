#!/bin/bash

# Simple utility script to bootstrap the local-audio-yomichan database
# Usage: ./bootstrap-audio-db.sh <audio_files_path> [output_db_path] [config_path]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we have the required arguments
if [ $# -lt 1 ]; then
    echo -e "${RED}Error: Missing required argument${NC}"
    echo -e "${YELLOW}Usage:${NC} $0 <audio_files_path> [output_db_path] [config_path]"
    echo ""
    echo -e "${BLUE}Arguments:${NC}"
    echo -e "  audio_files_path: Path to the directory containing audio files (required)"
    echo -e "  output_db_path:   Path where the SQLite database should be created (default: entries.db)"
    echo -e "  config_path:      Optional path to a custom config.json file"
    echo ""
    echo -e "${BLUE}Example:${NC}"
    echo -e "  $0 ~/Downloads/local-yomichan-audio-collection-2023-06-11-opus/user_files"
    echo -e "  $0 ~/Downloads/local-yomichan-audio-collection-2023-06-11-opus/user_files my_audio.db"
    echo -e "  $0 ~/Downloads/local-yomichan-audio-collection-2023-06-11-opus/user_files my_audio.db custom_config.json"
    exit 1
fi

AUDIO_FILES_PATH="$1"
OUTPUT_DB_PATH="${2:-entries.db}"
CONFIG_PATH="$3"

# Validate the audio files path
if [ ! -d "$AUDIO_FILES_PATH" ]; then
    echo -e "${RED}Error: Audio files directory does not exist: $AUDIO_FILES_PATH${NC}"
    exit 1
fi

# Create output directory if it doesn't exist
OUTPUT_DIR=$(dirname "$OUTPUT_DB_PATH")
if [ "$OUTPUT_DIR" != "." ] && [ ! -d "$OUTPUT_DIR" ]; then
    echo -e "${BLUE}Creating output directory: $OUTPUT_DIR${NC}"
    mkdir -p "$OUTPUT_DIR"
fi

# Validate config path if provided
if [ -n "$CONFIG_PATH" ] && [ ! -f "$CONFIG_PATH" ]; then
    echo -e "${RED}Error: Config file does not exist: $CONFIG_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}🚀 Starting audio database bootstrap...${NC}"
echo -e "${BLUE}Audio files path:${NC} $AUDIO_FILES_PATH"
echo -e "${BLUE}Database output:${NC} $OUTPUT_DB_PATH"
if [ -n "$CONFIG_PATH" ]; then
    echo -e "${BLUE}Config file:${NC} $CONFIG_PATH"
fi
echo ""

# Build the tool if it doesn't exist
if [ ! -f "./target/release/audio-db-bootstrap" ]; then
    echo -e "${YELLOW}Building audio-db-bootstrap tool...${NC}"
    cargo build --release -p audio-db-bootstrap
fi

# Set up environment variables
export LOCAL_AUDIO_YOMICHAN_DATA_DIR="$AUDIO_FILES_PATH"
if [ -n "$CONFIG_PATH" ]; then
    CONFIG_DIR=$(dirname "$CONFIG_PATH")
    export LOCAL_AUDIO_YOMICHAN_CONFIG_DIR="$CONFIG_DIR"
fi

# Build the command
CMD="./target/release/audio-db-bootstrap -a \"$AUDIO_FILES_PATH\" -o \"$OUTPUT_DB_PATH\" -v"
if [ -n "$CONFIG_PATH" ]; then
    CMD="$CMD -c \"$CONFIG_PATH\""
fi

echo -e "${BLUE}Running command:${NC} $CMD"
echo ""

# Execute the command
if eval $CMD; then
    echo ""
    echo -e "${GREEN}✅ Successfully created audio database at: $OUTPUT_DB_PATH${NC}"
    echo -e "${BLUE}You can now use this database with your jreader application.${NC}"
else
    echo ""
    echo -e "${RED}❌ Failed to create audio database${NC}"
    exit 1
fi
