# Wallet Ledger Reconciliation

## Results
- Invariant: balance reconstruction from ledger entries
- Tables: wallets, ledger_entries, game_rounds
- Endpoint: GET /api/v1/reconciliation/wallet/:userId
- Healthy: passed — drift=0, coverage gaps documented
- Corrupted: drift_detected — drift=500 (intentional)
- Build: passed

## ATM gates: 10 technical gates