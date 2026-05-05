# Production Casino Build Instructions

This document is the primary execution guide for building the real Fantasy Casino application.
It is intentionally more operational than the research pack: local agents should use it to choose
small implementation tasks without losing the production goal.

## 1. Product Goal

Build a production-grade fantasy casino platform that demonstrates AI-assisted development of a
real high-load application, not a toy demo.

The target system should be credible for:

- thousands of concurrent players online;
- high write volume from bets, rounds, wallet operations, and analytics events;
- large historical datasets;
- real frontend workflows built with React;
- backend invariants around wallet correctness, idempotency, auditability, and observability;
- staged evolution from local development to horizontally scalable architecture.

The experiment is not about adding more research documents. The experiment is whether the local
agent system can incrementally build, verify, and explain a serious application.

## 2. Non-Negotiable Direction

React is required for the frontend. Do not replace it with server-rendered HTML as the main product
UI.

The backend may be implemented in any suitable stack, but the implementation must support
production-grade patterns:

- explicit domain services;
- transactional wallet ledger;
- idempotency keys for money-affecting operations;
- database migrations;
- structured logging;
- metrics;
- tests at unit, integration, and API levels;
- load-testable endpoints;
- clear separation between product code and agent tooling.

The product must live under `product/`. The existing `agent/` directory is support tooling and
should not become the application.

## 3. Recommended Stack

Use this stack unless there is a strong reason to change it:

- Frontend: React, TypeScript, Vite, TanStack Query, React Router, Zustand only if local state grows.
- Styling: Tailwind CSS or CSS modules. Keep the UI operational and dense, not marketing-like.
- Backend: Node.js with Fastify and TypeScript, or Python with FastAPI. Prefer Node/Fastify if the
  local agent can handle TypeScript consistently because it aligns well with React and shared types.
- Database for local phase: PostgreSQL via Docker, not SQLite, because the stated goal is high-load
  production credibility.
- Cache and realtime: Redis for session/cache/rate-limit/realtime fanout primitives.
- Migrations: Prisma, Drizzle, or SQL migrations. Use explicit migration files.
- Tests: Vitest for frontend/domain TS, Playwright for browser flows, backend integration tests,
  and k6 for load tests.
- Observability: OpenTelemetry-ready structured logs, metrics endpoint, request IDs, trace IDs.

If Docker is not available locally, the agent may create the app with a documented fallback, but the
canonical architecture should still be PostgreSQL plus Redis.

## 4. Repository Ownership

Use these boundaries:

- `product/apps/web/` contains the React frontend.
- `product/apps/api/` contains the backend API.
- `product/packages/domain/` contains shared domain types, invariants, and pure logic.
- `product/packages/config/` contains shared configuration helpers.
- `product/packages/test-utils/` contains reusable test factories.
- `product/infra/` contains Docker Compose, database init scripts, k6 scripts, and local ops.
- `product/docs/` contains product-specific architecture notes generated during implementation.
- `agent/` contains orchestration tools only.
- `research/` remains strategic context. Do not edit it during product tasks unless the task says so.

Generated runtime artifacts must not be committed:

- planner outputs;
- snapshots;
- temporary test directories;
- logs;
- local databases;
- coverage output;
- Playwright reports;
- k6 result dumps unless explicitly curated.

## 5. Architecture Target

The system should evolve toward this shape:

```text
React Web App
  -> API Gateway / Backend API
      -> Auth Service
      -> Wallet Service
      -> Game Service
      -> Bonus Service
      -> Risk Service
      -> Analytics Event Service
      -> Admin Service
  -> PostgreSQL
  -> Redis
  -> Background Workers
  -> Observability Pipeline
```

In the local monorepo, these may begin as modules inside one backend process. However, the module
boundaries must be explicit enough that future extraction is plausible.

## 6. Core Production Invariants

These invariants matter more than speed of feature delivery.

Wallet invariants:

- Wallet balance must never be changed directly without a ledger entry.
- Every money-affecting operation must be idempotent.
- Every bet debit and win credit must be auditable.
- Ledger entries must be append-only.
- A failed round must not leave a partial wallet mutation.
- Currency and amount precision must be explicit. Do not use floating point for money.

Game invariants:

- Every game round has a stable ID.
- A round moves through explicit states such as `created`, `debit_reserved`, `settled`, `failed`,
  and `voided`.
- Randomness must be isolated behind an interface so it can be tested deterministically.
- The first game may be simple, but the engine shape must support multiple providers and game types.

API invariants:

- All mutating endpoints accept an idempotency key.
- All requests carry or receive a request ID.
- Errors use a consistent structured format.
- Authenticated and admin-only endpoints must be separated from the beginning.

Frontend invariants:

- React UI must represent real product state from the API.
- Do not fake wallet balance or round history in frontend state.
- Loading, error, empty, and optimistic update states must be handled deliberately.
- Critical wallet actions must not be hidden behind decorative UI.

Observability invariants:

- Every money-affecting operation logs structured context.
- Metrics exist for request latency, error rate, bet count, round settlement count, wallet mutation
  count, and idempotency replay count.
- Load tests must have clear pass/fail thresholds.

## 7. Build Phases

### Phase 0: Stabilize Agent Rails

Goal: stop the support tooling from creating unsafe or noisy changes.

- [ ] Apply sandbox validation to delete, quarantine, move, rename, and command execution paths.
- [ ] Replace unrestricted `shell=True` command execution with an allowlisted verification command
      runner, or make shell commands review-only until approved.
- [ ] Fix analytics event validation so required fields are accepted.
- [ ] Fix research summary line counts.
- [ ] Remove generated planner JSON, snapshots, tmp files, and runtime artifacts from staged source.
- [ ] Add or update `.gitignore` for local runtime outputs.
- [ ] Add a smoke verification command for `agent/` modules.

Exit criteria:

- `python3 -m py_compile` passes for all `agent/*.py` files.
- Generated runtime files are not staged.
- One low-risk agent task can move through plan, execute, verify, and finish without touching
  product source outside its declared scope.

### Phase 1: Product Monorepo Skeleton

Goal: create the real application foundation.

- [ ] Create `product/` monorepo structure.
- [ ] Create React/Vite/TypeScript frontend in `product/apps/web/`.
- [ ] Create backend API in `product/apps/api/`.
- [ ] Create shared domain package in `product/packages/domain/`.
- [ ] Add Docker Compose for PostgreSQL and Redis in `product/infra/`.
- [ ] Add migrations folder and first schema migration.
- [ ] Add root product commands for install, dev, test, lint, typecheck, and load test.
- [ ] Add health endpoint and frontend health page.

Exit criteria:

- Frontend runs locally.
- Backend runs locally.
- PostgreSQL and Redis run locally.
- Web app can call API health endpoint.
- Typecheck and basic tests pass.

### Phase 2: Identity And Session Foundation

Goal: build enough identity to support realistic player flows without overbuilding auth.

- [ ] Add user table and user domain model.
- [ ] Add local registration and login endpoints.
- [ ] Add password hashing.
- [ ] Add sessions or JWT strategy.
- [ ] Add frontend login/register screens.
- [ ] Add current-user API.
- [ ] Add basic admin role flag.

Exit criteria:

- A player can register, log in, refresh, and log out.
- Frontend uses real auth state from API.
- Admin-only route rejects non-admin users.

### Phase 3: Wallet And Ledger Core

Goal: implement the financial core as the first serious production slice.

- [ ] Add wallets table.
- [ ] Add append-only ledger entries table.
- [ ] Add idempotency table.
- [ ] Add deposit simulation endpoint.
- [ ] Add wallet balance read endpoint.
- [ ] Add ledger history endpoint.
- [ ] Add transactional wallet service.
- [ ] Add tests for deposit idempotency.
- [ ] Add tests for concurrent deposit requests.
- [ ] Add frontend wallet panel and ledger history.

Exit criteria:

- Balance changes only through ledger entries.
- Replaying the same idempotency key returns the original result.
- Concurrent requests do not corrupt balance.
- UI shows real wallet state and transaction history.

### Phase 4: Game Catalog And Round Engine

Goal: introduce real game lifecycle without pretending provider integration exists.

- [ ] Add game catalog table.
- [ ] Add game provider abstraction.
- [ ] Add seeded internal slot provider.
- [ ] Add game rounds table.
- [ ] Add bet placement endpoint.
- [ ] Add round settlement logic.
- [ ] Add deterministic test RNG implementation.
- [ ] Add production RNG interface implementation.
- [ ] Add tests for win, loss, insufficient funds, idempotency replay, and settlement failure.
- [ ] Add frontend lobby and slot game screen.

Exit criteria:

- A logged-in player can open lobby, start a slot game, place a bet, and see result.
- Bet debit and win credit are represented as ledger entries.
- Round history is visible in frontend.
- Failed settlement does not leave wallet in partial state.

### Phase 5: Realtime And High-Load Readiness

Goal: make the architecture credible for many active players.

- [ ] Add Redis-backed rate limiting.
- [ ] Add request ID middleware.
- [ ] Add structured JSON logs.
- [ ] Add metrics endpoint.
- [ ] Add background worker skeleton.
- [ ] Add event outbox table.
- [ ] Add outbox publisher worker.
- [ ] Add WebSocket or Server-Sent Events channel for wallet and round updates.
- [ ] Add frontend realtime updates.

Exit criteria:

- Hot mutating endpoints are rate limited.
- Wallet and round updates can arrive without full-page reload.
- Outbox stores events transactionally with domain changes.
- Metrics can be scraped locally.

### Phase 6: Bonus, Risk, And Compliance Shape

Goal: add casino-specific complexity that proves this is not just a CRUD app.

- [ ] Add bonus offers.
- [ ] Add bonus claims.
- [ ] Add wagering requirement tracking.
- [ ] Add bonus wallet or bonus ledger distinction.
- [ ] Add KYC status model.
- [ ] Add risk flags.
- [ ] Add admin review screens.
- [ ] Add tests for bonus wagering and risk-blocked betting.

Exit criteria:

- Bonus can be claimed and affects betting eligibility.
- Risk/KYC state can prevent selected actions.
- Admin UI can inspect users, wallets, rounds, and flags.

### Phase 7: Analytics And Data Platform

Goal: connect product behavior to analytics in a production-shaped way.

- [ ] Add analytics events table or event stream table.
- [ ] Validate emitted events against `agent/analytics_contract.py` or a product-owned contract.
- [ ] Emit events for registration, login, deposit, bet placed, round settled, bonus claimed, and
      risk flag changed.
- [ ] Add analytics outbox.
- [ ] Add metrics dashboard page.
- [ ] Add aggregate queries for GGR, bet count, active players, ARPU-like metrics, and conversion.

Exit criteria:

- Product actions emit valid analytics events.
- Invalid event payloads fail tests.
- Admin or analytics UI shows real aggregates from stored data.

### Phase 8: Load Testing And Production Hardening

Goal: demonstrate credible high-load behavior locally and document scaling path.

- [ ] Add k6 load tests for login, wallet read, deposit simulation, bet placement, and round history.
- [ ] Add database indexes based on query patterns.
- [ ] Add pagination for histories.
- [ ] Add API response time budgets.
- [ ] Add backpressure or rate-limit behavior for hot endpoints.
- [ ] Add failure-mode tests for DB errors, duplicate idempotency keys, and worker retries.
- [ ] Add production readiness checklist.

Exit criteria:

- Load tests have explicit thresholds.
- Core endpoints remain within documented local latency targets under load.
- Database query plans are checked for key hot paths.
- The scaling path is documented with bottlenecks and next infrastructure steps.

## 8. Task Format For Local Agents

Every implementation task must use this exact shape:

```md
### TASK <phase>-<number>: <title>

Status: planned
Risk: low|medium|high
Goal:
One sentence describing the product behavior to implement.

Scope:
- path 1
- path 2
- path 3

Do:
- Concrete action.
- Concrete action.
- Concrete action.

Do Not:
- Explicit non-goal.
- Explicit non-goal.
- Explicit non-goal.

Acceptance Criteria:
- Observable result.
- Testable result.
- Product behavior result.

Verification:
- command to run

Rollback:
- Files or migration rollback approach.
```

The agent should not start a task unless `Scope`, `Do Not`, and `Verification` are present.

## 9. Initial Task Backlog

Use this backlog after Phase 0 is complete.

### TASK 1-001: Create Product Monorepo Skeleton

Status: planned
Risk: medium
Goal:
Create the product application structure with React frontend, backend API, shared domain package,
and local infrastructure folder.

Scope:
- `product/package.json`
- `product/apps/web/`
- `product/apps/api/`
- `product/packages/domain/`
- `product/infra/`
- `product/README.md`

Do:
- Create workspace package configuration.
- Add React, TypeScript, and Vite app.
- Add backend API app.
- Add shared domain package.
- Add initial README with run commands.

Do Not:
- Implement wallet logic.
- Implement game logic.
- Modify `agent/` except if a verification command needs to know product path.
- Modify `research/`.

Acceptance Criteria:
- Product workspace exists.
- Frontend and backend have separate entrypoints.
- Shared domain package can be imported by both.

Verification:
- Run product install if dependencies are available.
- Run typecheck or compile command.

Rollback:
- Remove only files created under `product/` for this task.

### TASK 1-002: Add Local Infrastructure

Status: planned
Risk: medium
Goal:
Add PostgreSQL and Redis local infrastructure for product development.

Scope:
- `product/infra/docker-compose.yml`
- `product/apps/api/.env.example`
- `product/docs/local-development.md`

Do:
- Define PostgreSQL service.
- Define Redis service.
- Document connection strings.
- Add healthcheck notes.

Do Not:
- Store real secrets.
- Commit local `.env`.
- Implement application features.

Acceptance Criteria:
- Infrastructure config is present.
- API has documented env variables.
- Local development doc explains start/stop/reset.

Verification:
- `docker compose config` from `product/infra/`, if Docker is available.

Rollback:
- Remove infrastructure files created in this task.

### TASK 2-001: Implement Initial Database Schema

Status: planned
Risk: high
Goal:
Create the first production-shaped schema for users, sessions, wallets, ledger entries, idempotency,
games, and rounds.

Scope:
- `product/apps/api/src/db/`
- `product/apps/api/migrations/`
- `product/packages/domain/`

Do:
- Add migration runner or selected migration tool.
- Create users table.
- Create sessions table.
- Create wallets table.
- Create ledger entries table.
- Create idempotency keys table.
- Create games table.
- Create game rounds table.
- Add indexes for user lookup, wallet lookup, idempotency lookup, and round history.

Do Not:
- Build frontend screens.
- Add bonus or risk tables yet.
- Use floating point money columns.

Acceptance Criteria:
- Empty database can be migrated.
- Schema supports wallet and round lifecycle.
- Money amounts use integer minor units or precise decimal.

Verification:
- Run migration test or schema initialization test.

Rollback:
- Roll back migration using migration tool or drop only newly created local tables.

### TASK 3-001: Implement Wallet Ledger Deposit Flow

Status: planned
Risk: high
Goal:
Implement the first money-affecting flow with idempotency and transactional ledger correctness.

Scope:
- `product/apps/api/src/wallet/`
- `product/apps/api/src/idempotency/`
- `product/packages/domain/`
- `product/apps/api/tests/`

Do:
- Implement wallet service.
- Implement idempotent deposit simulation endpoint.
- Add ledger append function.
- Add balance update or balance derivation strategy.
- Add tests for first deposit, replayed deposit, and concurrent deposit attempts.

Do Not:
- Implement real payment provider.
- Implement withdrawals.
- Implement frontend wallet UI in this task.

Acceptance Criteria:
- Deposit creates one ledger entry.
- Replaying the same idempotency key does not double-credit.
- Concurrent deposits preserve balance correctness.

Verification:
- Run wallet integration tests.

Rollback:
- Remove wallet service changes and migration only if no later task depends on them.

### TASK 4-001: Implement Internal Slot Round

Status: planned
Risk: high
Goal:
Implement a playable internal slot round backed by wallet debit, settlement, and round history.

Scope:
- `product/apps/api/src/games/`
- `product/apps/api/src/wallet/`
- `product/packages/domain/`
- `product/apps/api/tests/`

Do:
- Add internal slot provider.
- Add deterministic RNG for tests.
- Implement bet debit.
- Implement round settlement.
- Implement win credit.
- Add tests for win, loss, insufficient funds, idempotent replay, and settlement failure.

Do Not:
- Add external provider integration.
- Add bonus logic.
- Add realtime updates.

Acceptance Criteria:
- A round cannot settle without a corresponding debit.
- A failed round does not corrupt wallet state.
- Round history records outcome and ledger references.

Verification:
- Run game integration tests.

Rollback:
- Revert game service changes and related tests.

### TASK 4-002: Build React Lobby And Slot Screen

Status: planned
Risk: medium
Goal:
Expose the real game flow through React.

Scope:
- `product/apps/web/src/`
- `product/apps/api/src/games/`
- `product/apps/api/src/wallet/`

Do:
- Build authenticated app shell.
- Build lobby screen.
- Build wallet panel.
- Build slot game screen.
- Fetch real balance and round history from API.
- Trigger real spin endpoint.
- Show loading and error states.

Do Not:
- Fake balance in frontend.
- Hardcode round results.
- Add marketing landing page.

Acceptance Criteria:
- User can play a complete round from browser.
- Balance updates from backend response.
- Round history updates after play.

Verification:
- Run frontend typecheck.
- Run browser smoke test or Playwright test.

Rollback:
- Revert frontend files and any API glue created only for this task.

## 10. Definition Of Done

A task is done only when:

- code is implemented within declared scope;
- tests or verification command pass;
- generated files are not accidentally staged;
- product behavior is described in one concise status note;
- any new technical debt is recorded as a follow-up task, not hidden.

## 11. Agent Behavior Rules

Local agents must follow these rules:

- Prefer product progress over agent-tool expansion.
- Keep tasks small enough to fit local context.
- Load only the files needed for the current task.
- Read this file before selecting the next task.
- Do not infer permission to edit broad areas of the repo.
- Do not modify generated artifacts unless the task is specifically about cleanup.
- Do not implement fake UI state when a backend endpoint exists or is in scope.
- Do not mark production features complete without tests.
- Ask for human review before changing wallet, ledger, idempotency, auth, or migration semantics.

## 12. Immediate Next Move

The next move should be Phase 0 cleanup, then `TASK 1-001`.

Do not start product code before cleaning the staged runtime artifacts and fixing the known safety
bugs. After that, create the React plus backend product skeleton and begin moving vertically through
wallet, game rounds, frontend, analytics, and load testing.
