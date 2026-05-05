# Fantasy Casino — AI-driven development experiment

[![Tests](https://img.shields.io/badge/tests-95%20passing-success)]()
[![TypeScript](https://img.shields.io/badge/typescript-0%20errors-blue)]()
[![Lint](https://img.shields.io/badge/lint-0%20errors-brightgreen)]()
[![Tailwind](https://img.shields.io/badge/tailwind-v4-38bdf8)]()
[![Phases](https://img.shields.io/badge/phases-15%2F15-orange)]()

A production-grade fantasy casino platform built as an AI-assisted development
experiment. **95% of the code written by local LLMs** (Qwen3.6-35B on Apple Silicon),
managed through a custom SQLite-backed task orchestration framework.

---

## What is this?

Two things in one repo:

1. **`product/`** — A fully playable casino platform: slots, roulette, PvP duels,
   wallet with ledger, leaderboards, achievements. React + TypeScript + Fastify +
   PostgreSQL + Redis. Tailwind v4 dark theme.

2. **`agent/`** — The task orchestration framework that managed the development:
   SQLite state machine, CLI micro-services, deterministic pipelines. This is the
   "Jira for AI agents" — read separately at
   [agent-task-manager](https://github.com/Wendigooor/agent-task-manager).

The experiment: can a local LLM build a non-trivial, production-shaped application
autonomously? Answer: yes, with the right constraints.

---

## Architecture

```
player → React SPA (12 pages) ──REST──→ Fastify API (15 route modules)
                                              │
                        ┌─────────────────────┼─────────────────────┐
                        ▼                     ▼                     ▼
                   PostgreSQL 17          Redis 7            SSE realtime
                   (12 tables,           (rate-limit,       (wallet, duels)
                    6 migrations)         cache)

agent/  (orchestration layer)
  ├── plans.db           Single source of truth
  ├── read_agent.py      Read-only queries
  ├── workitem_agent.py  Task CRUD
  ├── status_agent.py    State machine validation
  ├── milestone_agent.py Phase management
  └── orchestrator/      Planner → Executor → Verifier
```

---

## Quick Start

```bash
git clone git@github.com:Wendigooor/fantasy-casino-auto.git
cd fantasy-casino-auto/product

# Start infrastructure
npm run docker:up

# Install, migrate, seed
npm install
npm run db:migrate
npm run db:seed

# Run everything
npm run dev
```

Open `http://localhost:3000` — register and play.

API docs at `http://localhost:3001/docs` (Swagger).

### Without Docker

If PostgreSQL is available locally, set env vars and skip `docker:up`:

```bash
export POSTGRES_HOST=localhost POSTGRES_USER=casino \
  POSTGRES_PASSWORD=casino_dev_password POSTGRES_DB=fantasy_casino
```

---

## What's Inside

### Casino Platform (product/)

| Layer | Stack |
|-------|-------|
| Frontend | React 19, TypeScript, Vite, Tailwind v4, TanStack Query |
| Backend | Fastify 5, TypeScript, PostgreSQL, Redis |
| Testing | Vitest (95 tests), Playwright (E2E), k6 (load tests) |
| Packages | api, web, domain, config, test-utils |

**12 frontend pages:** Login, Lobby, Game/Slot, Wallet, Bonuses, KYC, Admin,
Roulette, Duels, Duel, Leaderboard, Achievements.

**15 API route modules:** auth, users, wallet, games, bonus, risk, events, kyc,
analytics, sse, metrics, dashboard, duel, leaderboard, achievement.

**12 database tables:** users, wallets, ledger_entries, idempotency_keys, games,
game_rounds, risk_scores, bonus_wagering, casino_events, kyc_verifications,
duels, duel_events.

**Features:** JWT auth, append-only wallet ledger, slot engine, roulette wheel
(CSS conic-gradient), PvP duels, SSE realtime, leaderboard, achievements,
confetti animations, web audio sound effects.

### Agent Framework (agent/)

The orchestration system that managed the entire development. **Single entry
point for all agents and humans.** Each task goes through:

```
read_agent next → context → claim → execute → verify → done
```

State machine prevents invalid transitions. ORM layer hides raw SQL. Every
task is tracked in `plans.db`.

### E2E Screenshots

Run headless browser tests that walk through the full player journey and capture screenshots:

```bash
cd product
node scripts/e2e-screenshots.mjs        # Player flow (9 screenshots)
node scripts/e2e-pvp-screenshots.mjs     # PvP duels (6 screenshots)
```

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Phases completed | 15/15 |
| Tasks completed | 101 |
| Tests passing | 95 |
| TypeScript errors | 0 |
| Lint errors | 0 |
| Frontend pages | 12 |
| API route modules | 15 |
| DB tables | 12 |
| DB migrations | 6 |
| k6 load scripts | 5 |
| Code written by LLM | ~95% |

---

## Development

```bash
cd product
npm run typecheck   # All 5 packages
npm run lint        # ESLint
npm run test        # 95 tests (requires PostgreSQL)
npm run dev         # API + Web
```

### Agent Commands

```bash
python3 agent/read_agent.py phases       # Project status
python3 agent/read_agent.py next         # Next task
python3 agent/read_agent.py context <id> # Task details
python3 agent/smoke_test.py             # Agent health (10 checks)
```

---

## Known Limitations

This is an engineering experiment, not a production gambling service. For a
detailed security review and growth roadmap, see the documentation in
`docs/` and the Confluence space. Key areas to address before production:
hardened JWT handling, tiered rate limiting, sandboxed execution, and
external payment provider integration.

---

## License

MIT
