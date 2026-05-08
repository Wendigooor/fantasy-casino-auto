# Reviewer Verdict: idempotency-replay-inspector

Reviewer role: fresh-context text reviewer
Input bundle: contract, profile, atm-export, summary, changed-files, source code, smoke report
Date: 2026-05-08

## Status

`requires_fix`

The ATM tiny-profile gates all passed and audit is clean, but the profile itself was underspecified and the implementation has unverified backend build and a residual security gap.

## Blocking Findings

| Severity | Finding | Evidence | Required Fix |
|---|---|---|---|
| critical | Build gate checks wrong target | profile.yaml: `cd product/apps/web && npx vite build` | Must check `cd product/apps/api && npm run build` |
| critical | API build/typecheck never proven | No `npm run typecheck` or `npm run build` for API in gates | Add API build/typecheck gate or run and record |
| major | `inspectKey` returns `result` before ownership check | route does `inspectKey` then checks `result.userId` vs `requesterId`; if key not found, `result.userId` is undefined, so first branch skips | Move ownership check after key found, or return `forbidden` before inspection for non-admin |
| major | `uid` helper imported but could use `request.user.id` directly | Minor: helper adds indirection | Simplify or keep consistent with codebase |

## Non-Blocking Findings

| Severity | Finding | Evidence | Suggested Fix |
|---|---|---|---|
| minor | `balance` variable removed but `ledgerTotal` unused | service code has `const ledgerTotal = ledgerR.rows.length` but never referenced | Remove or use |
| minor | `ledgerEntries` hardcoded to `0` in smoke report | smoke script: `ledgerEntries: 0` for all states | Query actual ledger count or document why 0 is correct |
| minor | Inspector does not check `idempotency_keys` table for `records` count > 1 | service queries `idempotency_keys` but only checks `rows.length` without timestamp comparison | Document that `records` field equals `rows.length` |

## Contradictions

- Summary says "Build: PASSED (exit 0)" but build gate was `cd product/apps/web && npx vite build`, not API build. The web build passed, API build was never run.
- Contract says "Preferred endpoint: GET /api/v1/idempotency/inspect/:key" — this exists, but contract also says "If an API endpoint is too much for budget, a script-only implementation is acceptable" — the endpoint was built, which is good.
- ATM verdict says `demo_done` but this is a technical feature with no UI. Verdict should be `technical_done` or `technical_partial` per contract Section 16.

## Missing Evidence

- No API build/typecheck command output or log.
- No `api-contract.md` in evidence (optional per contract, but useful for reviewer).
- No evidence that `npm run build` inside `product/apps/api` passes.

## Security / Data / Invariant Review

- Auth/ownership: Route now checks `result.userId !== requesterId` with admin fallback. This is acceptable but the order is wrong: `inspectKey` runs before auth check, leaking that a key exists (via timing or error shape) even if user is not authorized. **Fix:** return `forbidden` before calling `inspectKey` for non-admin users, or ensure `inspectKey` does not reveal key existence to unauthorized callers.
- Idempotency: Smoke test correctly proves no double-apply for spins. Good.
- Balance/accounting: Inspector reads ledger entries but does not verify they sum to wallet balance. Acceptable for a tiny inspector.
- Data leakage: `inspectKey` returns `userId` in response. If caller is admin, this is fine. If caller is self, this is their own ID. Acceptable.

## Final Recommendation

- Must fix before done:
  1. Fix build gate command to target API, not web.
  2. Run API build and record result.
  3. Reorder auth check in route to run before `inspectKey` (or ensure `inspectKey` is safe to call for any authenticated user).
- Can ship as partial: Current state is a working inspector + smoke test with correct no-double-apply proof. Profile gap is the main blocker.
- Accepted risks: Inspector does not do full reconciliation (out of scope for tiny feature).
