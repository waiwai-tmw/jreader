#!/bin/bash

# Utility script to verify and explore the contents of the audio database
# Usage: ./verify-audio-db.sh [database_path]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default database path
DB_PATH="${1:-entries.db}"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}Error: Database file does not exist: $DB_PATH${NC}"
    echo -e "${YELLOW}Usage:${NC} $0 [database_path]"
    echo -e "${BLUE}Default:${NC} $0 entries.db"
    exit 1
fi

echo -e "${GREEN}🔍 Verifying audio database: $DB_PATH${NC}"
echo ""

# Get file size
FILE_SIZE=$(ls -lh "$DB_PATH" | awk '{print $5}')
echo -e "${BLUE}Database size:${NC} $FILE_SIZE"
echo ""

# Function to run SQLite query and format output
run_query() {
    local query="$1"
    local description="$2"
    
    echo -e "${CYAN}$description:${NC}"
    sqlite3 "$DB_PATH" "$query" | while IFS='|' read -r line; do
        echo -e "  $line"
    done
    echo ""
}

# Basic database info
echo -e "${YELLOW}📊 Database Statistics:${NC}"
run_query "SELECT COUNT(*) as total_entries FROM entries;" "Total entries"
run_query "SELECT COUNT(DISTINCT expression) as unique_expressions FROM entries;" "Unique expressions"
run_query "SELECT COUNT(DISTINCT reading) as unique_readings FROM entries;" "Unique readings"
run_query "SELECT COUNT(DISTINCT source) as sources FROM entries;" "Number of sources"

# Source breakdown
echo -e "${YELLOW}📈 Entries by Source:${NC}"
run_query "SELECT source, COUNT(*) as count FROM entries GROUP BY source ORDER BY count DESC;" "Entries per source"

# Sample entries
echo -e "${YELLOW}📝 Sample Entries:${NC}"
run_query "SELECT expression, reading, source, file FROM entries LIMIT 10;" "First 10 entries"

# Check for entries with speakers (Forvo)
echo -e "${YELLOW}🎤 Forvo Entries with Speakers:${NC}"
run_query "SELECT COUNT(*) as forvo_entries FROM entries WHERE source = 'forvo' AND speaker IS NOT NULL;" "Forvo entries with speakers"
run_query "SELECT DISTINCT speaker FROM entries WHERE source = 'forvo' AND speaker IS NOT NULL LIMIT 5;" "Sample speakers"

# Check for entries with display info (NHK16, Shinmeikai8)
echo -e "${YELLOW}📺 Entries with Display Info:${NC}"
run_query "SELECT COUNT(*) as entries_with_display FROM entries WHERE display IS NOT NULL;" "Entries with display info"
run_query "SELECT source, display FROM entries WHERE display IS NOT NULL LIMIT 5;" "Sample display info"

# File extensions
echo -e "${YELLOW}🎵 Audio File Types:${NC}"
run_query "SELECT 
    CASE 
        WHEN file LIKE '%.opus' THEN 'Opus'
        WHEN file LIKE '%.mp3' THEN 'MP3'
        WHEN file LIKE '%.ogg' THEN 'Ogg'
        WHEN file LIKE '%.wav' THEN 'WAV'
        WHEN file LIKE '%.m4a' THEN 'M4A'
        WHEN file LIKE '%.aac' THEN 'AAC'
        WHEN file LIKE '%.flac' THEN 'FLAC'
        ELSE 'Other'
    END as file_type,
    COUNT(*) as count
FROM entries 
GROUP BY file_type 
ORDER BY count DESC;" "Audio file types"

# Database schema
echo -e "${YELLOW}🏗️ Database Schema:${NC}"
run_query ".schema entries" "Table schema"

echo -e "${GREEN}✅ Database verification complete!${NC}"
echo ""
echo -e "${BLUE}💡 Tips:${NC}"
echo -e "  • Use 'sqlite3 $DB_PATH' to explore interactively"
echo -e "  • Try: SELECT * FROM entries WHERE expression = 'こんにちは';"
echo -e "  • Try: SELECT * FROM entries WHERE source = 'forvo' LIMIT 5;"
