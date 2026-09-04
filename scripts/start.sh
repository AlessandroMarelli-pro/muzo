#!/bin/bash
# Starts the full Muzo stack and waits for the backend to be ready.

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f .env ]; then
  echo "❌ .env not found. Run ./scripts/install.sh first."
  exit 1
fi

echo "🐳 Starting Muzo..."

# AI_SERVICE_MODE only decides what starts here -- switching modes afterwards is a live UI action
# in Settings, not a re-run of this script (see AiServerPoolAdapter.reload()).
ai_service_mode=$(grep -E "^AI_SERVICE_MODE=" .env | cut -d= -f2)
ai_service_replicas=$(grep -E "^AI_SERVICE_REPLICAS=" .env | cut -d= -f2)
ai_service_replicas=${ai_service_replicas:-1}

if [ "$ai_service_mode" = "local" ]; then
  echo "   (local ai-service mode: starting ${ai_service_replicas} replica(s))"
  docker compose --profile local-ai up -d --scale "ai-service=${ai_service_replicas}"
else
  docker compose up -d
fi

# Ports may be overridden in .env -- read them the same way Compose does.
backend_port=$(grep -E "^BACKEND_PORT=" .env | cut -d= -f2)
backend_port=${backend_port:-3000}
frontend_port=$(grep -E "^FRONTEND_PORT=" .env | cut -d= -f2)
frontend_port=${frontend_port:-3001}

echo "⏳ Waiting for the backend to be ready..."
for i in $(seq 1 60); do
  if curl -sf "http://localhost:${backend_port}/health" > /dev/null 2>&1; then
    echo "✅ Backend is ready!"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "❌ Backend didn't become healthy in time. Check logs with: docker compose logs backend"
    exit 1
  fi
  sleep 2
done

echo ""
echo "🎉 Muzo is running:"
echo "   Frontend:        http://localhost:${frontend_port}"
echo "   Backend/GraphQL: http://localhost:${backend_port}/graphql"
echo ""
echo "Stop with: ./scripts/stop.sh"
