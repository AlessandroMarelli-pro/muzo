#!/bin/bash

# Muzo Backend Development Setup Script
# Brings up Postgres/Redis/Elasticsearch, runs migrations, and starts the dev server.

set -e

echo "🚀 Setting up Muzo Backend Development Environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.template .env
    echo "✅ .env file created. Please review and update as needed."
else
    echo "✅ .env file already exists."
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Start infra containers (Postgres, Redis, Elasticsearch, Kibana)
echo "🐳 Starting Postgres, Redis, and Elasticsearch containers..."
docker-compose up -d postgres redis elasticsearch

# Wait for Postgres to be ready
echo "⏳ Waiting for Postgres to be ready..."
for i in $(seq 1 30); do
    if docker exec muzo-postgres pg_isready -U muzo > /dev/null 2>&1; then
        echo "✅ Postgres is ready!"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "❌ Postgres failed to start. Check logs with: docker-compose logs postgres"
        exit 1
    fi
    sleep 2
done

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
for i in $(seq 1 15); do
    if docker exec muzo-redis redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis is ready!"
        break
    fi
    if [ "$i" -eq 15 ]; then
        echo "❌ Redis failed to start. Check logs with: npm run redis:logs"
        exit 1
    fi
    sleep 2
done

# Wait for Elasticsearch to be ready (slower to start -- JVM cold start)
echo "⏳ Waiting for Elasticsearch to be ready (this can take a minute)..."
for i in $(seq 1 60); do
    if curl -sf http://localhost:9200/_cluster/health > /dev/null 2>&1; then
        echo "✅ Elasticsearch is ready!"
        break
    fi
    if [ "$i" -eq 60 ]; then
        echo "❌ Elasticsearch failed to start. Check logs with: docker-compose logs elasticsearch"
        exit 1
    fi
    sleep 2
done

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run prisma:generate

# Run database migrations
echo "🗄️ Running database migrations..."
npm run prisma:migrate

echo ""
echo "🎉 Development environment ready -- starting the server..."
echo ""
echo "Useful commands (in another terminal):"
echo "- View Prisma Studio: npm run prisma:studio"
echo "- Access Redis CLI: npm run redis:cli"
echo "- Access Kibana: open http://localhost:5601"
echo "- Stop everything: docker-compose down"
echo ""

npm run start:dev
