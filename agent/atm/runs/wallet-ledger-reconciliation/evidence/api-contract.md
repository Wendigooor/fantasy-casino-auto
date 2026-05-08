# API Contract

GET /api/v1/reconciliation/wallet/:userId
Auth: Bearer token (self or admin)
Response: { userId, status, actualBalance, expectedBalance, drift, issues, warnings }
Statuses: balanced, drift_detected, invalid_ledger, coverage_gap, error
