# Idempotency Replay Inspector — Tiny Technical Feature Contract

Version: 2026-05-08
Mode: tiny-technical
Run id: idempotency-replay-inspector
Budget intent: very small/cheap autonomous run, suitable for low API budget.

## 1. Mission

Build a tiny backend-only tool that inspects idempotency behavior for wallet/game operations and proves that repeated requests with the same idempotency key do not double-apply money movement.

No UI.
No screenshots.
No visual review.
No demo HTML.

The output is a JSON report and ATM verdict/audit result.

## 2. Why This Feature

Casino systems need idempotency. Duplicate client requests, network retries, or agent-run scripts must not duplicate deposits, withdrawals, spins, or ledger movements.

This feature is intentionally small:

- existing code already has `idempotency_keys`;
- existing tests already touch withdrawal and spin idempotency;
- the agent should mostly inspect, expose, and verify;
- success is objective and cheap to evaluate.

## 3. Product / Technical Value

Internal value:

- Give developers/operators a quick way to inspect replay safety for one user/key.
- Produce an audit-style report showing whether duplicate requests caused duplicated ledger entries or balance changes.
- Surface suspicious repeated keys or mismatched response fingerprints.

Experiment value:

- Tests autonomous technical work without frontend ambiguity.
- Tests ATM/audit discipline after `v0.5.3`.
- Should be doable quickly by a weaker/cheaper model.

## 4. Scope

Implement a minimal inspector for idempotency keys.

Required:

- Read idempotency records for a user/key.
- Summarize related ledger entries and wallet balance deltas.
- Provide one protected API endpoint or one CLI script.
- Provide a deterministic smoke script that creates a duplicate-request scenario and writes a JSON report.
- Run through ATM gates and `atm audit`.

Preferred endpoint:

```http
GET /api/v1/idempotency/inspect/:key
```

Alternative acceptable:

```http
GET /api/v1/internal/idempotency/:key
```

If an API endpoint is too much for budget, a script-only implementation is acceptable, but this must be explicitly justified in `summary.md`.

## 5. Non-Goals

Do not:

- build UI;
- touch visual CSS;
- create screenshots;
- redesign wallet/game logic;
- change financial behavior unless a bug is found and proven;
- add a large backoffice page;
- implement a generic analytics system.

## 6. Discovery Requirements

Before coding, inspect and record:

- `idempotency_keys` schema;
- wallet deposit/withdrawal idempotency flow;
- slot spin idempotency flow;
- ledger entry creation around duplicate requests;
- existing tests covering idempotency.

Evidence can be a note in ATM plus `evidence/discovery.md`.

## 7. Required Report

The smoke script must write:

```text
agent/atm/runs/idempotency-replay-inspector/evidence/idempotency-report.json
```

Required shape:

```json
{
  "run": "idempotency-replay-inspector",
  "operation": "deposit-or-withdrawal-or-spin",
  "idempotencyKey": "string",
  "assertions": {
    "firstRequestSucceeded": true,
    "secondRequestReplayed": true,
    "ledgerNotDuplicated": true,
    "balanceNotDoubleApplied": true,
    "inspectorReturnedKey": true,
    "noUnhandledErrors": true
  },
  "before": {
    "balance": 100000,
    "ledgerEntries": 1
  },
  "afterFirst": {
    "balance": 101000,
    "ledgerEntries": 2
  },
  "afterSecond": {
    "balance": 101000,
    "ledgerEntries": 2
  },
  "inspector": {
    "status": "safe_replay",
    "key": "string",
    "ledgerDelta": 1,
    "balanceDelta": 1000,
    "replayCount": 2,
    "warnings": []
  }
}
```

## 8. Required Statuses

Inspector status should be one of:

- `safe_replay`
- `duplicate_applied`
- `key_not_found`
- `ambiguous`
- `error`

## 9. Suggested Implementation

Keep implementation tiny.

Suggested files:

```text
product/apps/api/src/services/idempotency-inspector.ts
product/apps/api/src/routes/idempotency-routes.ts
product/scripts/idempotency-replay-smoke.mjs
```

If route registration exists in `index.ts`, register the route under protected routes.

## 10. API Response Shape

```json
{
  "key": "idem-key",
  "status": "safe_replay",
  "userId": "uuid",
  "records": 1,
  "ledgerEntries": 1,
  "balanceDelta": 1000,
  "warnings": [],
  "checkedAt": "2026-05-08T00:00:00.000Z"
}
```

## 11. Smoke Script

Create:

```text
product/scripts/idempotency-replay-smoke.mjs
```

Required behavior:

1. Register/authenticate a test user.
2. Record wallet balance and ledger count.
3. Execute one idempotent operation with a fixed idempotency key.
4. Execute the same operation again with the same key.
5. Confirm balance and ledger count do not change after the second request.
6. Call inspector endpoint or service/script.
7. Write `idempotency-report.json`.
8. Exit `0` only if all assertions are true.

Prefer deposit or withdrawal because existing tests already cover them. Use spin only if easier.

## 12. ATM Commands

Use ATM as the source of truth.

```bash
./scripts/atm doctor
./scripts/atm init-run --id idempotency-replay-inspector --profile tiny-technical --contract agent/atm/runs/idempotency-replay-inspector/contract.md
./scripts/atm import-gates --id idempotency-replay-inspector --file agent/atm/profiles/tiny-technical.yaml
./scripts/atm next --id idempotency-replay-inspector
```

If `agent/atm/profiles/tiny-technical.yaml` does not exist, create it.

## 13. Tiny Technical ATM Profile

Create this profile if missing:

```yaml
gates:
  - id: gate.discovery
    title: Idempotency schema and write paths inspected
    severity: critical
    kind: manual

  - id: gate.implementation
    title: Inspector implementation exists
    severity: critical
    kind: file_exists_or_note
    paths:
      - product/apps/api/src/services/idempotency-inspector.ts

  - id: gate.build
    title: Relevant build or API build passes
    severity: critical
    kind: command
    command: cd product/apps/api && npm run build

  - id: gate.smoke
    title: Idempotency replay smoke passes
    severity: critical
    kind: command
    command: cd product && ATM_EVIDENCE_DIR=../agent/atm/runs/idempotency-replay-inspector/evidence node scripts/idempotency-replay-smoke.mjs

  - id: gate.evidence.report
    title: Idempotency JSON report exists
    severity: critical
    kind: file_exists
    paths:
      - agent/atm/runs/idempotency-replay-inspector/evidence/idempotency-report.json

  - id: gate.evidence.package
    title: Evidence package complete
    severity: critical
    kind: file_exists
    paths:
      - agent/atm/runs/idempotency-replay-inspector/evidence/summary.md
      - agent/atm/runs/idempotency-replay-inspector/evidence/idempotency-report.json
      - agent/atm/runs/idempotency-replay-inspector/evidence/changed-files.md
      - agent/atm/runs/idempotency-replay-inspector/evidence/atm-export.json
```

No typecheck gate is required for this tiny budget run, unless the agent can run it cheaply. If typecheck is skipped, `summary.md` must state that this is a tiny technical profile and typecheck is out of scope.

## 14. Evidence Package

Required files:

```text
agent/atm/runs/idempotency-replay-inspector/evidence/
  summary.md
  changed-files.md
  idempotency-report.json
  atm-export.json
```

Optional:

```text
agent/atm/runs/idempotency-replay-inspector/evidence/discovery.md
agent/atm/runs/idempotency-replay-inspector/evidence/api-contract.md
```

## 15. Success Criteria

Minimum success:

- Smoke script exits `0`.
- Report proves second request did not double-apply balance.
- Report proves ledger count did not duplicate on replay.
- ATM verdict is not `invalid`.
- `atm audit --id idempotency-replay-inspector` passes.

Gold success:

- API endpoint exists and is protected.
- Report includes inspector response.
- Duplicate application can be detected if intentionally simulated.
- Evidence package is fully inside `agent/atm/runs/idempotency-replay-inspector/evidence`.

## 16. Stop Rules

Final answer must be `TECHNICAL_PARTIAL`, not done, if:

- `./scripts/atm audit --id idempotency-replay-inspector` fails;
- smoke script was not run through ATM;
- report is missing;
- build gate fails;
- evidence exists outside the run folder only;
- second request changes balance or creates duplicate ledger entries.

## 17. Final Response Template

The final response must include:

```text
STATUS: DONE | TECHNICAL_PARTIAL | FAILED
ATM verdict:
ATM audit:
Smoke report:
Changed files:
Known limitations:
```

No screenshots. No visual claims.
