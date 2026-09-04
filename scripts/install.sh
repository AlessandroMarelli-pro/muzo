#!/bin/bash
# Muzo installer: checks/installs system dependencies, bootstraps .env, and
# builds the Docker images. Run once before scripts/start.sh.

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "🎵 Muzo installer"
echo ""

# ---------------------------------------------------------------------------
# Docker
# ---------------------------------------------------------------------------
if ! command -v docker &> /dev/null || ! docker info &> /dev/null; then
  echo "❌ Docker is not installed or not running."
  case "$(uname -s)" in
    Darwin) echo "   Install Docker Desktop: https://www.docker.com/products/docker-desktop" ;;
    Linux)  echo "   Install Docker Engine: https://docs.docker.com/engine/install/" ;;
    *)      echo "   Install Docker Desktop: https://www.docker.com/products/docker-desktop" ;;
  esac
  echo "   Start Docker, then re-run this script."
  exit 1
fi
echo "✅ Docker is installed and running."

if ! docker compose version &> /dev/null; then
  echo "❌ Docker Compose v2 is required (bundled with modern Docker Desktop)."
  exit 1
fi
echo "✅ Docker Compose is available."

# ---------------------------------------------------------------------------
# ffmpeg (used directly by the backend for audio processing)
# ---------------------------------------------------------------------------
if ! command -v ffmpeg &> /dev/null; then
  echo "⚠️  ffmpeg not found on PATH -- required for audio processing."
  case "$(uname -s)" in
    Darwin) echo "   Install with: brew install ffmpeg" ;;
    Linux)  echo "   Install with: sudo apt install ffmpeg  (or your distro's package manager)" ;;
    *)      echo "   Download from: https://ffmpeg.org/download.html" ;;
  esac
else
  echo "✅ ffmpeg is installed."
fi

# ---------------------------------------------------------------------------
# sockseek (Soulseek CLI, used directly by the backend -- not containerized)
# ---------------------------------------------------------------------------
if command -v sockseek &> /dev/null; then
  echo "✅ sockseek is installed ($(sockseek --version 2>/dev/null || echo 'version unknown'))."
else
  echo "📦 sockseek not found -- installing (required for Soulseek downloads)..."

  os="$(uname -s)"
  arch="$(uname -m)"
  case "$os" in
    Darwin)
      case "$arch" in
        arm64) asset_suffix="osx-arm64.tar.gz" ;;
        *)     asset_suffix="osx-x64.tar.gz" ;;
      esac
      ;;
    Linux)
      case "$arch" in
        aarch64|arm64) asset_suffix="linux-arm.tar.gz" ;;
        *)             asset_suffix="linux-x64.tar.gz" ;;
      esac
      ;;
    *)
      echo "⚠️  Unrecognized OS '$os' -- can't auto-install sockseek."
      echo "   Download manually from: https://github.com/fiso64/sockseek/releases/latest"
      asset_suffix=""
      ;;
  esac

  if [ -n "$asset_suffix" ]; then
    release_url="https://api.github.com/repos/fiso64/sockseek/releases/latest"
    download_url=$(curl -sf "$release_url" | grep "browser_download_url.*${asset_suffix}" | head -1 | cut -d '"' -f4)

    if [ -z "$download_url" ]; then
      echo "⚠️  Couldn't find a sockseek release asset for ${os}/${arch}."
      echo "   Download manually from: https://github.com/fiso64/sockseek/releases/latest"
    else
      tmp_dir=$(mktemp -d)
      echo "   Downloading $download_url"
      curl -sfL "$download_url" -o "$tmp_dir/sockseek.tar.gz"
      tar -xzf "$tmp_dir/sockseek.tar.gz" -C "$tmp_dir"
      binary_path=$(find "$tmp_dir" -type f -name "sockseek" | head -1)
      if [ -z "$binary_path" ]; then
        echo "⚠️  Extracted archive didn't contain a 'sockseek' binary -- install manually."
      else
        chmod +x "$binary_path"
        if [ -w /usr/local/bin ]; then
          mv "$binary_path" /usr/local/bin/sockseek
        else
          echo "   /usr/local/bin isn't writable, using sudo..."
          sudo mv "$binary_path" /usr/local/bin/sockseek
        fi
        echo "✅ sockseek installed to /usr/local/bin/sockseek"
      fi
      rm -rf "$tmp_dir"
    fi
  fi
fi

# ---------------------------------------------------------------------------
# .env
# ---------------------------------------------------------------------------
if [ ! -f .env ]; then
  echo "📝 Creating .env from .env.example..."
  cp .env.example .env

  # Auto-generate BETTER_AUTH_SECRET -- it has no safe default.
  if command -v openssl &> /dev/null; then
    secret=$(openssl rand -base64 32)
    # Portable in-place sed (macOS's sed needs -i '', GNU sed needs -i without an arg)
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s|^BETTER_AUTH_SECRET=$|BETTER_AUTH_SECRET=${secret}|" .env
    else
      sed -i "s|^BETTER_AUTH_SECRET=$|BETTER_AUTH_SECRET=${secret}|" .env
    fi
    echo "✅ Generated BETTER_AUTH_SECRET."
  else
    echo "⚠️  openssl not found -- set BETTER_AUTH_SECRET in .env manually."
  fi

  # MUSIC_DIR -- mounted into the backend container at the identical host
  # path, so absolute paths stored in the DB (a library's rootPath) and set
  # via env vars (SOCKSEEK_OUTPUT_DIR/TIDAL_OUTPUT_DIR/PLAYLIST_EXPORT_DIR)
  # resolve without translation. Ask interactively rather than silently
  # assume ~/Music -- library scanning silently sees nothing if this is
  # wrong, which is a confusing failure mode to debug after the fact.
  default_music_dir="${HOME}/Music"
  if [ -t 0 ]; then
    read -r -p "📁 Music library folder [${default_music_dir}]: " music_dir
  else
    music_dir=""
  fi
  music_dir="${music_dir:-$default_music_dir}"
  # Expand a leading ~ if the user typed one.
  music_dir="${music_dir/#\~/$HOME}"

  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s|^# MUSIC_DIR=.*|MUSIC_DIR=${music_dir}|" .env
  else
    sed -i "s|^# MUSIC_DIR=.*|MUSIC_DIR=${music_dir}|" .env
  fi
  echo "✅ MUSIC_DIR set to ${music_dir}"

  echo ""
  echo "⚠️  AI analysis (genre/BPM/key/mood detection) needs an ai-service."
  echo "   Configure it after first start from Settings in the app -- pick"
  echo "   Local (runs on this machine) or Remote (a Hugging Face Inference"
  echo "   Endpoint you deploy yourself, see ai-service/docker/deploy-hf.sh)"
  echo "   and it takes effect immediately, no restart needed. The app runs"
  echo "   fine without either configured, just without that feature."
  echo ""
else
  echo "✅ .env already exists."
fi

# ---------------------------------------------------------------------------
# Build images
# ---------------------------------------------------------------------------
echo "🐳 Building Docker images (this can take a few minutes the first time)..."
docker compose build

echo ""
echo "🎉 Install complete. Run ./scripts/start.sh to start Muzo."
