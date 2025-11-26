#!/bin/bash

# Muzo Backend Development Setup Script
# This script sets up the development environment with Redis and Prisma

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

# Start Redis container
echo "🐳 Starting Redis container..."
npm run redis:up

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
sleep 5

# Check Redis health
if docker exec muzo-redis-dev redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is ready!"
else
    echo "❌ Redis failed to start. Check logs with: npm run redis:logs"
    exit 1
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run prisma:generate

# Run database migrations
echo "🗄️ Running database migrations..."
npm run prisma:migrate

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Start the development server: npm run start:dev"
echo "2. Check Redis status: npm run redis:logs"
echo "3. Access Redis CLI: npm run redis:cli"
echo "4. View Prisma Studio: npm run prisma:studio"
echo ""
echo "Useful commands:"
echo "- Stop Redis: npm run redis:down"
echo "- Restart Redis: npm run redis:down && npm run redis:up"
echo "- Clear Redis data: npm run redis:flush"
echo "- Cleanup everything: npm run dev:cleanup"
