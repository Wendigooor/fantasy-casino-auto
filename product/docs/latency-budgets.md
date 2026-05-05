# API Latency Budgets

Target latencies for critical endpoints under load (single-instance, local PostgreSQL).

| Endpoint | Method | Budget (p95) | Budget (p99) | Notes |
|----------|--------|--------------|--------------|-------|
| /health | GET | 50ms | 100ms | Health check, no DB |
| /auth/register | POST | 500ms | 1000ms | bcrypt cost 12 |
| /auth/login | POST | 500ms | 1000ms | bcrypt compare |
| /users/me | GET | 100ms | 200ms | Single-row lookup |
| /wallet | GET | 100ms | 200ms | Cached, Redis-skippable |
| /wallet/deposit | POST | 200ms | 500ms | Write + idempotency check |
| /wallet/withdraw | POST | 200ms | 500ms | Write + state check |
| /wallet/ledger | GET | 200ms | 500ms | Paginated history |
| /games | GET | 100ms | 200ms | Catalog read |
| /games/slot/spin | POST | 300ms | 800ms | Bet debit + win credit + round insert |
| /games/history | GET | 500ms | 1000ms | Paginated with joins |
| /bonus/rules | GET | 100ms | 200ms | Catalog read |
| /bonus/claim | POST | 300ms | 800ms | Bonus calc + deposit + wagering insert |
| /kyc/status | GET | 100ms | 200ms | Single-row lookup |
| /metrics | GET | 50ms | 100ms | In-memory counters |
| /admin/dashboard/ops | GET | 1000ms | 2000ms | Aggregation queries |

## Monitoring

Slow requests (> 2× p95 budget) log a warning with request ID.

## Scaling Plan

- Wallet reads: cache with Redis (5s TTL) → p95 < 50ms
- Spin: move to async worker with Result-First response → p95 < 100ms
- Dashboard: pre-aggregate hourly → p95 < 200ms
- History: timestamp-based partitioning → p95 < 300ms
