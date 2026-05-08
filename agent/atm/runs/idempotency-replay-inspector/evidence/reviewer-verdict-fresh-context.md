---
reviewer_model: kimi-k2.6
reviewer_provider: opencode-go
session_type: same-model-fresh-context
executor_model: kimi-k2.6
feature: idempotency-replay-inspector
timestamp: 2026-05-08T17:00:00Z
---

## Status
requires_fix

## Blocking Findings

| Severity | Finding | Evidence | Required Fix |
|----------|---------|----------|--------------|
| HIGH | Route path violates contract | Contract specifies `GET /api/v1/idempotency/inspect/:key`. Source shows `app.get("/idempotency/inspect/:key", ...)`. No evidence of `/api/v1` prefix mounting. | Mount or register the route at the exact path required by contract. |

## Non-Blocking Findings

| Severity | Finding | Evidence |
|----------|---------|----------|
| MED | Type assertion on `request.params` | `(request.params as { key: string }).key` in `idempotency-routes.ts`. Fastify routes should declare params via schema to avoid runtime mismatches. |
| LOW | Implicit public access for unowned keys | If `result.userId` is null/falsy, ownership check is bypassed. Source does not show behavior for `key_not_found` or `ambiguous` ownership. |
| LOW | Missing actual inspector source | Only a summary description of `idempotency-inspector.ts` is provided; full source is not in evidence bundle. |

## Contradictions

- **Path prefix**: Contract mandates `/api/v1/idempotency/inspect/:key`. Implementation artifact shows `/idempotency/inspect/:key`. No artifact confirms prefix mounting.
- **"Prove duplicate requests do not double-apply money"**: Smoke report claims balance `100000→99900→99900`, but the evidence bundle does not contain the smoke test source code, so the assertion cannot be independently verified.

## Missing Evidence

- Full source code of `idempotency-inspector.ts` (only summary description provided).
- Smoke test source code / assertions.
- ATM profile YAML or gate checklist to verify what the 6/6 gates actually tested.
- Evidence of how the route is registered in the Fastify application (whether a prefix is applied upstream).

## Security / Data / Invariant Review

- **SQL Injection**: Not observed. Query uses parameterized placeholder `$1` for `requesterId`.
- **Authorization**: Ownership check exists but is conditional on `result.userId` being truthy. Admin fallback is present. Without seeing `inspectKey` source, cannot verify if this is exhaustive.
- **Idempotency invariant**: Balance trace `100000→9900→9900` suggests no double-apply for the tested case, but without test code this is taken on trust.
- **Data leak**: If a key has no associated `userId`, any requester can inspect it. May be intentional, but not documented.

## Final Recommendation

Do not promote past `requires_fix`. The route path is a hard contract violation. Provide the actual `idempotency-inspector.ts` source and smoke test code in the next evidence bundle so the reviewer can verify the safe_replay/duplicate_applied logic and balance assertions independently.
