# Fantasy Casino

Production-grade fantasy casino platform built as an AI-assisted development exercise.

## Structure

```
product/
├── apps/
│   ├── web/          — React + Vite + TypeScript frontend
│   └── api/          — Fastify + TypeScript backend API
├── packages/
│   ├── domain/       — Shared domain types and logic
│   └── config/       — Shared configuration
├── infra/            — Docker Compose, DB init scripts
└── docs/             — Architecture notes
```

## Quick Start

```bash
# Install dependencies
npm install

# Start infrastructure (PostgreSQL + Redis)
npm run docker:up

# Run migrations
npm run db:migrate

# Start dev servers
npm run dev
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all dev servers (web + api) |
| `npm run build` | Build all packages and apps |
| `npm run test` | Run tests across all packages |
| `npm run lint` | Lint all code |
| `npm run typecheck` | Typecheck all TypeScript |
| `npm run db:migrate` | Run database migrations |
| `npm run docker:up` | Start PostgreSQL and Redis |
| `npm run docker:down` | Stop infrastructure |
| `npm run load:test` | Run k6 load tests |
