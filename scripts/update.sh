#!/bin/bash
# Updates an already-running Muzo instance: pulls the latest code, rebuilds
# images, and restarts. Data volumes (Postgres, Elasticsearch, Redis) are
# never touched -- your library survives an update.
#
# Database migrations run automatically on backend startup (see
# backend/docker-entrypoint.sh) -- no separate migrate step needed here.

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "📥 Pulling latest changes..."
git pull

echo "🐳 Rebuilding images..."
docker compose build

echo "🔄 Restarting (only containers whose image actually changed are recreated)..."
docker compose up -d

echo ""
echo "✅ Update complete. Your data was not touched."
echo "   Check logs with: docker compose logs -f backend"
