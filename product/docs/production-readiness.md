# Production Readiness Checklist

## Core Platform (v0.1.0)

### Wallet & Ledger
- [x] Balance changes only through append-only ledger entries
- [x] Idempotent deposits and withdrawals
- [x] Pessimistic locking (FOR UPDATE) on wallet mutations
- [x] Wallet state machine (active/frozen/closed)
- [x] BIGINT (cents) amounts — no floating point
- [x] Concurrent deposit safety tests
- [x] Edge case validation (negative/zero amounts, state checks)
- [ ] Withdrawal approval workflow for large amounts
- [ ] Multi-currency exchange rates

### Game Engine
- [x] Slot spin with deterministic RNG (testable)
- [x] Round state machine (created → settled/failed)
- [x] Bet debit + win credit as ledger entries
- [x] Spin idempotency
- [x] Provider adapter interface
- [ ] Roulette and blackjack games
- [ ] External provider integration (Pragmatic, Evolution)

### Auth & Security
- [x] JWT authentication with role-based access
- [x] Password hashing (bcrypt, 12 rounds)
- [x] Admin vs player role separation
- [x] Rate limiting (Redis-backed, graceful fallback)
- [x] Zod input validation on mutating endpoints
- [ ] Refresh token rotation
- [ ] 2FA support
- [ ] IP-based anomaly detection

### Observability
- [x] Structured JSON logs (Pino)
- [x] Request IDs on every request
- [x] Metrics endpoint (/metrics)
- [x] Health check with DB status and memory
- [x] Analytics event emission (register, login, deposit, withdraw, spin, bonus)
- [x] Event outbox with batch-flush
- [ ] OpenTelemetry tracing
- [ ] Alerting thresholds
- [ ] Distributed tracing across services

### Performance & Scale
- [x] Connection pooling (pg Pool)
- [x] Database indexes on hot paths (6 indexes)
- [x] API pagination (games, wallets)
- [x] k6 load test scripts (deposit 100 VU, spin 100 VU)
- [x] Redis connection with graceful fallback
- [ ] Connection pool tuning per workload
- [ ] Read replica support
- [ ] Query plan optimization for top 10 queries

### Testing
- [x] 55 tests across auth, wallet, game, edge cases
- [x] Unit tests (password hashing, validation, JWT structure)
- [x] Integration tests (full auth flow, wallet deposit/withdraw, game spin)
- [x] Deterministic RNG for reproducible game tests
- [x] Test utilities package with factories
- [ ] Playwright browser tests
- [ ] k6 integration with CI
- [ ] Chaos testing (DB failures, Redis failures)

### DevOps
- [x] Docker Compose (PostgreSQL 17 + Redis 7)
- [x] Database migrations with version tracking
- [x] Seed script (games + bonus rules)
- [x] Swagger API documentation (/docs)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Automated DB migration testing
- [ ] Secrets management (Vault/Infisical)

### Frontend
- [x] React 19 + TypeScript + Vite
- [x] Real API state (no fake data)
- [x] Loading, error, empty states
- [x] SSE realtime wallet updates
- [x] Responsive dark theme
- [x] 8 pages: Login, Lobby, Game, Wallet, Bonuses, KYC, Admin, Health
- [ ] Accessibility audit (a11y)
- [ ] Mobile responsive testing
- [ ] Performance audit (Lighthouse)

### Known Technical Debt
1. **Drizzle ORM** installed but unused — migrate or remove
2. **Rate limiter** in-memory fallback when Redis unavailable — limited to single instance
3. **SSE** instead of WebSocket — works but less efficient for bidirectional updates
4. **Wallet balance** in `users/me` endpoint deprecated — use `/wallet`
5. **ulidx** package installed but unused — remove

### Next Infrastructure Steps
1. Add Redis Cluster for multi-instance rate limiting
2. Add PostgreSQL read replicas for analytics queries
3. Deploy behind Nginx/Caddy reverse proxy
4. Add Prometheus + Grafana for metrics visualization
5. Implement CI/CD pipeline
6. Add automated DB backup strategy
7. Implement horizontal scaling for API (stateless + Redis sessions)
