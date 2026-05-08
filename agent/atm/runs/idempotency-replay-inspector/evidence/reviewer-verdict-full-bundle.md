---
reviewer_model: kimi-k2.6
reviewer_provider: opencode-go
session_type: full-bundle-fresh-context
---

## Status
REJECT with conditions. Backend route exists and smoke assertions pass, but critical security flaw in auth order and core business logic is unauditable due to missing source evidence.

## Blocking Findings (table)

| # | Finding | Evidence | Severity |
|---|---------|----------|----------|
| 1 | **Auth order violation: inspectKey executes before ownership check.** In `source/idempotency-routes.ts`, `await inspectKey(app.pg, key)` runs at line 4, but requester identity and role are verified only at lines 5-10. Unauthorized users trigger a full DB query before being rejected. | `source/idempotency-routes.ts` lines 4-10 | Security / DoS |
| 2 | **Core `inspectKey` implementation is unauditable.** `source/idempotency-inspector.ts` shows only a comment (`// Queries idempotency_keys...`). No actual function body, SQL, or logic is visible. Cannot verify safe_replay, duplicate detection, or ledger deduplication logic. | `source/idempotency-inspector.ts` excerpt | Completeness |
| 3 | **Build/typecheck proof absent.** Summary claims "Build PASSED" but no build stdout, stderr, or artifact timestamps are present. `atm-export.json` notes "No typecheck gate", yet also claims "6/6 gates" while `active-profile.yaml` defines only 3 explicit gates. | `summary.md`, `atm-export.json`, `active-profile.yaml` | Trust / Verification |

## Non-Blocking Findings (table)

| # | Finding | Evidence | Severity |
|---|---------|----------|----------|
| 1 | `uid(request)` implementation not shown. Cannot verify auth source (JWT, session, header). | `source/idempotency-routes.ts` line 3 | Transparency |
| 2 | Smoke test script source (`scripts/<run-id>-smoke.mjs`) not included. Assertions are reported but execution path is opaque. | `active-profile.yaml` gate.smoke | Transparency |
| 3 | No HTTP request/response logs or curl evidence. Report JSON could be hand-authored. | `reports/idempotency-report.json` | Trust |
| 4 | `demo_done` verdict for a backend feature with "No UI" is semantically odd. `tech_done` would be more precise, though profile mapping may justify it. | `atm-export.json`, `contract.md` | Semantic |

## Contradictions

1. **Gate count mismatch.** `atm-export.json` claims "6/6 gates". `active-profile.yaml` lists 3 gates (`build`, `smoke`, `evidence.report`). The report JSON contains 6 assertions. The export appears to conflate "assertions" with "gates" — a terminology error that undermines confidence in the ATM automation.

2. **"No typecheck gate" yet build gate present.** `active-profile.yaml` defines `gate.build` but `atm-export.json` explicitly flags "No typecheck gate". For a TypeScript backend, typecheck absence is notable but profile-declared, so not a contradiction in process — only in rigor.

## Missing Evidence

- [ ] Full source of `source/idempotency-inspector.ts` (function body, SQL queries, safe_replay logic).
- [ ] `uid()` helper implementation and auth middleware registration.
- [ ] Build stdout/stderr or artifact timestamps proving `npm run build` executed.
- [ ] Smoke test script source (`scripts/<run-id>-smoke.mjs`).
- [ ] Raw HTTP request/response logs or curl output hitting `GET /api/v1/idempotency/inspect/:key`.
- [ ] Database schema / migration for `idempotency_keys` and `ledger_entries`.
- [ ] `known-limitations.md` is empty — no mention of auth order issue or unverified edge cases.

## Security / Data / Invariant

- **Auth order (Blocking):** `inspectKey` performs database reads before the requester's role is validated. Even though unauthorized users ultimately receive `{status: "forbidden"}`, the query cost is paid and any exceptions/errors inside `inspectKey` could leak stack traces or timing info to attackers. Correct pattern: validate requester identity and (for cross-user keys) admin role **before** calling `inspectKey`.
- **Data exposure vector:** `result.userId` check depends on `inspectKey` returning a `userId` field. If `inspectKey` omits this field for certain statuses, the ownership check is silently skipped and the raw result is returned. This is a latent bug depending on unverified implementation.
- **Invariant partially validated:** Balance stays constant across replay (100000 → 99900 → 99900), confirming no double-apply. However, without seeing the smoke test script, we cannot confirm the replay was triggered via the actual HTTP endpoint vs. direct function call.

## Final Recommendation

**Do not promote to done.** Require:
1. Fix auth order in `idempotency-routes.ts` (check ownership/admin role **before** calling `inspectKey`).
2. Provide full `source/idempotency-inspector.ts` source for audit.
3. Provide build logs or a reproducible build artifact.
4. Provide smoke test script source or raw HTTP evidence.

Once (1) and (2) are supplied, re-review. (3) and (4) are strongly recommended but may be waived if the ATM profile explicitly accepts assertion-only evidence.
