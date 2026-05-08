# Idempotency Replay Inspector

## What was built
- Inspector service: inspect idempotency key replay safety
- API: GET /api/v1/idempotency/inspect/:key
- Smoke script: duplicate request test

## Results
- Build: PASSED (exit 0)
- Smoke: PASSED (exit 0)
- 6 assertions, all true
- Balance: 100000 → 99900 (first) → 99900 (replay) — no double apply
- Inspector status: safe_replay

## Files changed
- product/apps/api/src/services/idempotency-inspector.ts (new)
- product/apps/api/src/routes/idempotency-routes.ts (new)
- product/apps/api/src/index.ts (modified)
- product/scripts/idempotency-replay-smoke.mjs (new)
