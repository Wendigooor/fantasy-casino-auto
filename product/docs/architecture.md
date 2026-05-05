# Fantasy Casino — Architecture

## System Overview

```
React Web App (Vite + TanStack Query)
  ├── SSE (realtime updates)
  └── REST API (Fastify + TypeScript)
        ├── Auth Service (JWT)
        ├── Wallet Service (PostgreSQL, append-only ledger)
        ├── Game Service (slot engine, deterministic RNG)
        ├── Bonus Service (rules, wagering)
        ├── Risk Service (scoring, auto-freeze)
        ├── KYC Service (verification workflow)
        ├── Analytics (EventEmitter + batch-flush)
        ├── Rate Limiting (Redis — falls back gracefully)
        └── Metrics (/metrics endpoint)
      PostgreSQL 17 (primary data store)
      Redis 7 (cache, rate limiting)
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/auth/register | Public | Register new player |
| POST | /api/v1/auth/login | Public | Login |
| GET | /api/v1/users/me | JWT | Current user profile |
| GET | /api/v1/users | Admin | List all users |
| GET | /api/v1/wallet | JWT | Wallet balance |
| POST | /api/v1/wallet/deposit | JWT | Deposit (idempotent) |
| POST | /api/v1/wallet/withdraw | JWT | Withdrawal |
| GET | /api/v1/wallet/ledger | JWT | Transaction history |
| POST | /api/v1/wallet/freeze | JWT | Freeze own wallet |
| POST | /api/v1/wallet/unfreeze | JWT | Unfreeze wallet |
| GET | /api/v1/games | Public | List games (paginated) |
| POST | /api/v1/games/slot/spin | JWT | Spin slot |
| GET | /api/v1/games/history | JWT | Round history |
| GET | /api/v1/bonus/rules | JWT | Bonus rules |
| POST | /api/v1/bonus/claim | JWT | Claim bonus (creates ledger entry) |
| GET | /api/v1/bonus/wagering | JWT | Wagering progress |
| POST | /api/v1/risk/score | JWT | Get risk score |
| GET | /api/v1/risk/status | JWT | Risk status |
| GET | /api/v1/kyc/status | JWT | KYC verification status |
| POST | /api/v1/kyc/submit | JWT | Submit KYC |
| GET | /api/v1/admin/kyc/pending | Admin | Pending verifications |
| POST | /api/v1/admin/kyc/:id/review | Admin | Review KYC |
| GET | /api/v1/analytics/events | JWT | Player events |
| GET | /api/v1/sse | JWT | SSE realtime stream |
| GET | /api/v1/dashboard/ops | Admin | Operations dashboard |
| GET | /metrics | Public | System metrics |
| GET | /health | Public | Health check (includes DB status) |
| GET | /docs | Public | Swagger UI |

## Database Schema

10 tables:

- **users** — player/admin accounts
- **wallets** — per-user, per-currency balances (BIGINT cents)
- **ledger_entries** — append-only transaction log
- **idempotency_keys** — de-duplication
- **games** — catalog + bonus rules (type='bonus')
- **game_rounds** — spin results, state machine
- **risk_scores** — fraud detection records
- **bonus_wagering** — wagering requirement tracking
- **casino_events** — event sourcing
- **kyc_verifications** — identity verification

## Invariants

- Wallet balance changes **only** through ledger entries
- All money operations are **idempotent**
- Game rounds follow: `created → settled/failed/voided`
- Amounts stored as **BIGINT** (cents), never floating-point
- PostgreSQL `FOR UPDATE` pessimistic locking for financial operations
