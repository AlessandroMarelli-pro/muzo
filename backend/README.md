# Muzo Backend

AI-powered music library organization backend API built with NestJS, GraphQL, Prisma, and BullMQ queues.

## Features

- **GraphQL API** - Modern GraphQL API with Apollo Server
- **Database Integration** - Prisma ORM with SQLite (compatible with Turso/LibSQL)
- **Queue System** - BullMQ-based asynchronous processing for audio file scanning
- **AI Integration** - Audio analysis and genre classification
- **TypeScript** - Full TypeScript support with strict typing
- **Testing** - Jest testing framework with comprehensive test coverage
- **Code Quality** - ESLint and Prettier for code formatting and linting
- **Docker Support** - Redis container for queue management

## Tech Stack

- **Framework**: NestJS 11.x
- **API**: GraphQL with Apollo Server
- **Database**: Prisma ORM with SQLite (Turso/LibSQL compatible)
- **Queues**: BullMQ with Redis
- **Language**: TypeScript 5.x
- **Testing**: Jest
- **Linting**: ESLint + Prettier
- **Containerization**: Docker (Redis)

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- npm or yarn

### Quick Setup

```bash
# Run the automated setup script
./setup-dev.sh
```

### Manual Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp env.template .env

# Start Redis container
npm run redis:up

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start development server
npm run start:dev
```

### Available Scripts

#### Development

- `npm run start:dev` - Start development server with hot reload
- `npm run start:debug` - Start with debugging enabled
- `npm run build` - Build the application
- `npm run test` - Run unit tests
- `npm run test:cov` - Run tests with coverage
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

#### Database Management

- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:deploy` - Deploy migrations to production
- `npm run prisma:reset` - Reset database (development only)
- `npm run prisma:studio` - Open Prisma Studio (visual database browser)

#### Redis Management

- `npm run redis:up` - Start Redis container
- `npm run redis:down` - Stop Redis container
- `npm run redis:logs` - View Redis logs
- `npm run redis:cli` - Access Redis CLI
- `npm run redis:flush` - Clear all Redis data

#### Development Utilities

- `npm run dev:setup` - Setup development environment (Redis + Prisma)
- `npm run dev:cleanup` - Cleanup development environment

## Project Structure

```
src/
├── config/           # Configuration files (database, AI service, queues)
├── modules/          # Feature modules
│   ├── queue/        # BullMQ queue system
│   ├── ai-integration/ # AI service integration
│   ├── music-library/ # Music library management
│   └── health/       # Health check endpoints
├── shared/           # Shared services and utilities
├── models/           # Database entities (Prisma models)
└── main.ts          # Application entry point

prisma/
├── schema.prisma    # Database schema
└── migrations/      # Database migrations

tests/
├── contract/        # API contract tests
├── integration/     # Integration tests
└── unit/           # Unit tests

docker-compose.yml   # Production Redis container
docker-compose.dev.yml # Development Redis container
```

## Queue System

The backend includes a comprehensive queue system for asynchronous audio file processing:

### Features

- **Library Scanning**: Recursively scan music libraries for audio files
- **Audio Analysis**: AI-powered analysis of individual audio files
- **Batch Processing**: Efficient handling of multiple files
- **Error Handling**: Retry logic with exponential backoff
- **Monitoring**: Queue statistics and job tracking

### Queue Endpoints

- `POST /queue/scan-all-libraries` - Scan all libraries
- `POST /queue/scan-library/{id}` - Scan specific library
- `GET /queue/stats` - Get queue statistics
- `POST /queue/pause` - Pause all queues
- `POST /queue/resume` - Resume all queues
- `DELETE /queue/clear` - Clear all queues

### Queue Management

```bash
# Check queue status
curl http://localhost:3000/queue/stats

# Access Redis CLI
npm run redis:cli

# Monitor Redis logs
npm run redis:logs
```

## Health Endpoints

- `GET /health` - Overall application health with database status
- `GET /health/database` - Database-specific health check

## Environment Variables

See `env.template` for required environment variables.

## Development

This project follows NestJS best practices and includes:

- Dependency injection
- Modular architecture
- Comprehensive error handling
- Input validation
- Type safety
- Prisma ORM integration

## License

MIT
