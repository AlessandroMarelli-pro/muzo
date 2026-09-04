#!/bin/bash
# Stops the Muzo stack without removing containers or data volumes -- fast
# to restart with ./scripts/start.sh. Use `docker compose down` directly if
# you actually want to remove the containers (data volumes are still
# preserved even then -- use `docker compose down -v` to also wipe data).
#
# No --profile flag needed: `stop`/`down` act on every container carrying
# this project's compose labels, local-ai profile or not -- that includes
# ai-service replicas the backend created live via the Docker socket (see
# src/infrastructure/docker/docker-scaling.service.ts), since those carry
# the same labels a `docker compose up --scale` container would.

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "🛑 Stopping Muzo..."
docker compose stop
echo "✅ Stopped. Your data is untouched -- restart with ./scripts/start.sh"
