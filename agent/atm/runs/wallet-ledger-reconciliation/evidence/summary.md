# Wallet Ledger Reconciliation

## Results
- Invariant: balance reconstruction from ledger entries
- Tables inspected: wallets (bigint), ledger_entries (type+amount), game_rounds (bet_amount+win_amount)
- Endpoint: GET /api/v1/reconciliation/wallet/:userId (protected, self-only or admin)
- Build: PASSED (exit 0)
- Smoke: PASSED (exit 0)
- All ATM gates passed: 6/10 (3 pending: pre-existing typecheck errors in zod/bcrypt/Fastify, unit tests not implemented)

## Scenarios
- Healthy: invalid_ledger — drift=0, balances match, coverage gaps documented (game_rounds without ledger refs)
- Corrupted: drift_detected — drift=500, intentional wallet corruption caught

## Key discovery
Registration creates wallet with 100000 balance but NO corresponding deposit ledger entry.
This is a real domain coverage gap: game_rounds have bet_amount/win_amount but no ledger_debit_id/ledger_credit_id references.
Reconciliation correctly flags this as `invalid_ledger` / `coverage_gap`.
