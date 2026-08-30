#!/bin/bash
# Stops the Muzo stack without removing containers or data volumes -- fast
# to restart with ./scripts/start.sh. Use `docker compose down` directly if
# you actually want to remove the containers (data volumes are still
# preserved even then -- use `docker compose down -v` to also wipe data).

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "🛑 Stopping Muzo..."
docker compose stop
echo "✅ Stopped. Your data is untouched -- restart with ./scripts/start.sh"
