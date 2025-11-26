#!/bin/bash

# YouTube Music Playlist Downloader
# Usage: ./download_playlist.sh <playlist_id> <number_of_tracks>
# Example: ./download_playlist.sh "PLrAKWdKgX5wA..." 15

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if correct number of arguments provided
if [ $# -ne 2 ]; then
    print_error "Usage: $0 <playlist_id> <number_of_tracks>"
    print_info "Example: $0 'PLrAKWdKgX5wA...' 15"
    print_info "Note: You can use either the full playlist URL or just the playlist ID"
    exit 1
fi

PLAYLIST_ID="$1"
NUM_TRACKS="$2"

# Validate number of tracks is a positive integer
if ! [[ "$NUM_TRACKS" =~ ^[1-9][0-9]*$ ]]; then
    print_error "Number of tracks must be a positive integer"
    exit 1
fi

# Check if yt-dlp is installed
if ! command -v yt-dlp &> /dev/null; then
    print_error "yt-dlp is not installed. Please install it first:"
    print_info "brew install yt-dlp"
    exit 1
fi

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    print_error "ffmpeg is not installed. Please install it first:"
    print_info "brew install ffmpeg"
    exit 1
fi

# Determine if input is a full URL or just playlist ID
if [[ "$PLAYLIST_ID" == *"youtube.com"* ]] || [[ "$PLAYLIST_ID" == *"youtu.be"* ]]; then
    PLAYLIST_URL="$PLAYLIST_ID"
else
    # Assume it's just the playlist ID and construct the URL
    PLAYLIST_URL="https://music.youtube.com/playlist?list=$PLAYLIST_ID"
fi

print_info "Starting download from playlist: $PLAYLIST_URL"
print_info "Number of tracks to download: $NUM_TRACKS"
print_info "Download location: $(pwd)"

# Create a timestamp for this download session
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DOWNLOAD_DIR="."

print_info "Creating download directory: $DOWNLOAD_DIR"
mkdir -p "$DOWNLOAD_DIR"

# Download playlist with highest quality audio
print_info "Downloading tracks..."

yt-dlp \
    --extract-audio \
    --audio-format flac \
    --audio-quality 0 \
    --playlist-end "$NUM_TRACKS" \
    --output "$DOWNLOAD_DIR/%(title)s.%(ext)s" \
    --parse-metadata "title:%(artist)s - %(title)s" \
    --parse-metadata "genres:%(genres)s" \
    --embed-metadata \
    --add-metadata \
    --ignore-errors \
    --no-warnings \
    --progress \
    --external-downloader ffmpeg \
    --external-downloader-args "-ss 00:00:00.00 -to 00:03:00.00" \
    "$PLAYLIST_URL"

# Check if download was successful
if [ $? -eq 0 ]; then
    print_success "Download completed successfully!"
    print_info "Files saved in: $DOWNLOAD_DIR"
    
    # Show downloaded files
    print_info "Downloaded files:"
    ls -la "$DOWNLOAD_DIR"
    
    # Show total file count
    FILE_COUNT=$(ls -1 "$DOWNLOAD_DIR" | wc -l | tr -d ' ')
    print_success "Total files downloaded: $FILE_COUNT"
    
else
    print_error "Download failed or completed with errors"
    print_warning "Check the playlist URL and try again"
    exit 1
fi

print_success "Script execution completed!"