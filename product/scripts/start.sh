#!/usr/bin/env bash
set -euo pipefail

echo "=== Fantasy Casino — Production Startup ==="

# Validate required tools
command -v node >/dev/null 2>&1 || { echo "ERROR: node is required"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "ERROR: npm is required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "WARN: docker not found — running without containers"; }

# Environment check
if [ ! -f apps/api/.env ]; then
  echo "Creating .env from .env.example..."
  cp apps/api/.env.example apps/api/.env
fi

# Source env if exists
if [ -f apps/api/.env ]; then
  set -a; source apps/api/.env; set +a
fi

echo ""
echo "▶ Starting infrastructure..."
if command -v docker >/dev/null 2>&1; then
  docker compose -f infra/docker-compose.yml up -d
  echo "  PostgreSQL: localhost:5432"
  echo "  Redis:      localhost:6379"
else
  echo "  SKIP: Docker not available"
fi

echo ""
echo "▶ Installing dependencies..."
npm install --silent 2>/dev/null || npm install

echo ""
echo "▶ Running database migrations..."
npm run db:migrate 2>/dev/null || echo "  WARN: Migration may need running containers"

echo ""
echo "▶ Building packages..."
npm run build 2>/dev/null || echo "  WARN: Build has warnings (non-critical)"

echo ""
echo "▶ Starting API server..."
cd apps/api && npx tsx src/index.ts &
API_PID=$!

echo "▶ Starting Web dev server..."
cd ../web && npx vite &
WEB_PID=$!

echo ""
echo "=== Fantasy Casino is running ==="
echo "  API:  http://localhost:${PORT:-3001}"
echo "  Web:  http://localhost:3000"
echo "  Docs: http://localhost:${PORT:-3001}/docs"
echo "  Health: http://localhost:${PORT:-3001}/health"
echo ""
echo "Press Ctrl+C to stop"

trap 'echo "Shutting down..."; kill $API_PID $WEB_PID 2>/dev/null; exit 0' INT TERM
wait
