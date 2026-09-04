#!/bin/bash
# Updates an already-running Muzo instance: pulls the latest code, rebuilds
# images, and restarts. Data volumes (Postgres, Redis) are never touched --
# your library survives an update.
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

# AI_SERVICE_MODE decides whether the local-ai profile (and its published image, not built
# locally) is part of this update -- see scripts/start.sh for the same check.
ai_service_mode=$(grep -E "^AI_SERVICE_MODE=" .env | cut -d= -f2)
ai_service_replicas=$(grep -E "^AI_SERVICE_REPLICAS=" .env | cut -d= -f2)
ai_service_replicas=${ai_service_replicas:-1}

echo "🔄 Restarting (only containers whose image actually changed are recreated)..."
if [ "$ai_service_mode" = "local" ]; then
  docker compose --profile local-ai pull ai-service
  docker compose --profile local-ai up -d --scale "ai-service=${ai_service_replicas}"
else
  docker compose up -d
fi

echo ""
echo "✅ Update complete. Your data was not touched."
echo "   Check logs with: docker compose logs -f backend"
