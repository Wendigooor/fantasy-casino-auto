# Local Development Guide

## Prerequisites

- Node.js 20+
- Docker (for PostgreSQL and Redis)
- Note: Docker is required for infrastructure. If not available, use a hosted PostgreSQL/Redis service and update connection strings.

## Quick Start

```bash
# From product/ directory

# 1. Install dependencies
npm install

# 2. Start infrastructure
npm run docker:up

# 3. Run database migrations
npm run db:migrate

# 4. Start dev servers (runs web + api in parallel)
npm run dev
```

## Services

| Service | URL | Port |
|---------|-----|------|
| Frontend | http://localhost:3000 | 3000 |
| API | http://localhost:3001 | 3001 |
| PostgreSQL | localhost:5432 | 5432 |
| Redis | localhost:6379 | 6379 |

## Environment Variables

Copy `.env.example` to `.env` in the `apps/api/` directory and adjust as needed:

```bash
cp apps/api/.env.example apps/api/.env
```

## Database

```bash
# Run migrations
npm run db:migrate

# View logs
npm run docker:logs

# Stop infrastructure
npm run docker:down

# Rebuild from scratch
npm run docker:down && npm run docker:up && npm run db:migrate
```

## Commands

```bash
# Development
npm run dev          # Start all dev servers
npm run build        # Build all packages

# Testing
npm run test         # Run all tests
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint

# API only
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database

# Infrastructure
npm run docker:up    # Start PostgreSQL + Redis
npm run docker:down  # Stop infrastructure
```
