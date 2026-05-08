# Wallet Ledger Reconciliation — Technical Feature Contract

Version: 2026-05-08
Mode: technical
Run id: wallet-ledger-reconciliation
Primary goal: validate autonomous backend/internal delivery through ATM without screenshots or visual review.

## 1. Mission

Build a deterministic wallet ledger reconciliation feature for Fantasy Casino.

The feature must prove that user balances, wallet transactions, game rounds, rewards, and ledger entries are internally consistent. It should expose a safe technical API and a CLI/script report that can be evaluated without any browser screenshots.

This run intentionally excludes visual polish. The success artifact is a machine-readable evidence package: migrations, service logic, API responses, automated tests, reconciliation report JSON, command logs, and ATM verdict.

## 2. Why This Feature

Casino systems live or die by accounting correctness. A beautiful UI is useless if wallet balance, bet debits, win credits, rewards, and ledger entries drift.

This feature is designed to test whether an autonomous agent can:

- understand existing wallet/game/bonus data flows;
- add a technical subsystem without breaking product behavior;
- define invariants before coding;
- create deterministic seed/test data;
- catch inconsistencies instead of hiding them;
- produce evidence that can be audited by another model or human.

## 3. User / Business Value

Internal operator value:

- Detect balance drift before it becomes a player support or compliance issue.
- Explain how a wallet balance was derived.
- Identify orphan game rounds, missing ledger entries, duplicate idempotency keys, and reward posting mistakes.
- Provide a foundation for backoffice risk/compliance tooling later.

Experiment value:

- Tests autonomous technical implementation without visual ambiguity.
- Replaces “does it look good?” with “do invariants hold?”
- Produces objective pass/fail evidence.

## 4. Scope

Implement backend-only reconciliation for one user and optionally all users.

Required capabilities:

- Reconstruct expected wallet balance from ledger entries.
- Compare expected balance with wallet table balance.
- Detect drift.
- Detect orphan game rounds without corresponding ledger evidence if the existing architecture expects ledger coverage.
- Detect duplicate or suspicious idempotency keys where relevant.
- Detect negative balance violations.
- Detect reward entries without supported source records where relevant.
- Return a structured reconciliation report.
- Provide a deterministic script/test that creates both healthy and intentionally broken scenarios.

No frontend page is required.
No screenshots are required.
No visual review is required.

## 5. Definitions

Ledger entry:

- A durable financial event that changes or explains wallet balance.
- Examples may include deposit, withdrawal, bet debit, win credit, bonus reward, tournament reward, mission reward, lightning reward.

Balance drift:

- Difference between wallet balance stored in `wallets` and balance reconstructed from ledger entries.

Reconciliation report:

- JSON object that lists balance status, expected balance, actual balance, drift amount, issue counts, and issue details.

Invariant:

- A rule that must always hold unless the report explicitly classifies and explains a violation.

## 6. Discovery Requirements

Before implementation, the agent must use ATM and record discovery evidence.

Required discovery:

- Inspect wallet schema.
- Inspect ledger schema.
- Inspect game round schema.
- Inspect wallet service write paths.
- Inspect slot spin flow.
- Inspect mission/tournament/lightning reward write paths if present.
- Identify how amounts are represented: integer cents, decimal, or raw number.
- Identify existing transaction boundaries.
- Identify existing idempotency mechanisms.
- Identify existing tests and scripts.

Discovery evidence must include:

- Tables inspected.
- Relevant columns.
- Existing source files read.
- Existing behavior summary.
- Explicit list of invariants selected for implementation.

## 7. Required Invariants

The feature must implement at least these invariants.

### 7.1 Balance Reconstruction

For a selected user:

```text
expectedBalance = openingBalance + sum(ledger_entries signed amounts)
drift = wallet.balance - expectedBalance
```

If the project has no explicit opening balance, infer the correct baseline from existing seed/deposit conventions and document it.

Pass condition:

- Healthy seeded user returns `status: "balanced"` and `drift: 0`.

Fail condition:

- Intentionally corrupted wallet returns `status: "drift_detected"` and non-zero drift.

### 7.2 Non-Negative Wallet

Wallet balance must not be negative unless the existing domain explicitly allows credit.

Pass condition:

- Negative balance is reported as issue type `negative_balance`.

### 7.3 Ledger Entry Validity

Each ledger entry must have:

- user id;
- amount;
- type;
- timestamp;
- direction or enough type information to infer signed amount.

Pass condition:

- Malformed or unsupported entries appear in `issues`.

### 7.4 Game Round Coverage

For game rounds involving real wallet movement:

- bet debits must be traceable;
- win credits must be traceable when win amount is positive;
- idempotency key behavior must not double-post balance changes.

If the current architecture does not write ledger entries for spins, the report must classify this explicitly as `coverage_gap`, not silently pass.

### 7.5 Reward Coverage

For mission/tournament/lightning rewards where money or points affect wallet/accounting:

- reward source should be traceable;
- duplicate claims should not duplicate wallet value.

If a reward system is not wallet-backed, document it and exclude it from wallet balance reconstruction.

## 8. API Contract

Add one protected technical endpoint.

Recommended route:

```http
GET /api/v1/reconciliation/wallet/:userId
```

Alternative is acceptable if it better matches existing route structure, but it must be documented.

Required response shape:

```json
{
  "userId": "uuid",
  "status": "balanced",
  "actualBalance": 1000,
  "expectedBalance": 1000,
  "drift": 0,
  "currency": "USD",
  "checkedAt": "2026-05-08T00:00:00.000Z",
  "summary": {
    "ledgerEntries": 12,
    "gameRounds": 5,
    "issues": 0,
    "warnings": 0
  },
  "issues": [],
  "warnings": []
}
```

Required statuses:

- `balanced`
- `drift_detected`
- `invalid_ledger`
- `coverage_gap`
- `error`

Issue object shape:

```json
{
  "type": "missing_win_credit",
  "severity": "critical",
  "entity": "game_round",
  "entityId": "uuid",
  "message": "Win amount exists but no corresponding ledger entry was found"
}
```

## 9. Service Contract

Add a dedicated service module.

Recommended file:

```text
product/apps/api/src/services/reconciliation.ts
```

Required exported behavior:

- `reconcileWallet(userId: string): Promise<WalletReconciliationReport>`
- Pure-ish calculation helpers for signed ledger totals.
- Issue classifier helpers.

The route must be thin. Business logic belongs in the service.

## 10. Database / Migration Contract

If schema changes are needed, add a migration.

Possible additions:

- ledger entry source columns;
- reconciliation audit table;
- indexes for reconciliation performance.

Do not mutate existing data silently.

If no schema changes are needed:

- explicitly record why in ATM evidence;
- provide SQL queries used by reconciliation.

Recommended optional table:

```sql
CREATE TABLE reconciliation_runs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL,
  drift NUMERIC NOT NULL DEFAULT 0,
  issues_count INTEGER NOT NULL DEFAULT 0,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  report JSONB NOT NULL
);
```

This table is optional. The core requirement is correctness of the report.

## 11. Demo / Verification Script

No browser demo.

Create a deterministic technical verification script.

Recommended path:

```text
product/scripts/reconciliation-smoke.mjs
```

Required behavior:

1. Authenticate or create a test user.
2. Seed a healthy wallet/ledger scenario.
3. Call reconciliation endpoint.
4. Assert `status === "balanced"`.
5. Create an intentionally corrupted scenario.
6. Call reconciliation endpoint.
7. Assert non-balanced status and at least one critical issue.
8. Write JSON report to:

```text
agent/atm/runs/wallet-ledger-reconciliation/evidence/reconciliation-report.json
```

Required report shape:

```json
{
  "run": "wallet-ledger-reconciliation",
  "healthyScenario": {
    "passed": true,
    "status": "balanced",
    "drift": 0
  },
  "corruptedScenario": {
    "passed": true,
    "status": "drift_detected",
    "drift": 100,
    "issues": ["balance_drift"]
  },
  "assertions": {
    "apiReachable": true,
    "healthyBalanced": true,
    "corruptionDetected": true,
    "noUnhandledErrors": true
  }
}
```

## 12. ATM Execution Contract

Use ATM as the only source of truth.

Required commands:

```bash
./scripts/atm doctor
./scripts/atm init-run --id wallet-ledger-reconciliation --profile technical --contract agent/atm/runs/wallet-ledger-reconciliation/contract.md
./scripts/atm import-gates --id wallet-ledger-reconciliation --file agent/atm/profiles/technical.yaml
./scripts/atm next --id wallet-ledger-reconciliation
```

If `technical.yaml` does not exist, create it.

The run must not use screenshot gates.

## 13. Required Technical Gates

Create or use an ATM technical profile with these gates.

```yaml
gates:
  - id: gate.discovery.schema
    title: Wallet, ledger, game round schemas inspected
    severity: critical
    kind: manual

  - id: gate.discovery.write_paths
    title: Wallet write paths and transaction boundaries inspected
    severity: critical
    kind: manual

  - id: gate.contract.invariants
    title: Reconciliation invariants documented before implementation
    severity: critical
    kind: manual

  - id: gate.implementation.service
    title: Reconciliation service implemented
    severity: critical
    kind: file_exists
    paths:
      - product/apps/api/src/services/reconciliation.ts

  - id: gate.implementation.route
    title: Protected reconciliation API route implemented
    severity: critical
    kind: manual

  - id: gate.implementation.migration
    title: Migration added or explicitly justified as unnecessary
    severity: critical
    kind: file_exists_or_note

  - id: gate.build.production
    title: Production build passes
    severity: critical
    kind: command
    command: cd product && npm run build

  - id: gate.typecheck
    title: Typecheck passes
    severity: critical
    kind: command
    command: cd product && npm run typecheck

  - id: gate.tests.unit
    title: Unit tests for reconciliation calculations pass
    severity: critical
    kind: command
    command: cd product && npm run test -- --runInBand reconciliation

  - id: gate.tests.smoke
    title: Reconciliation smoke script passes and writes report
    severity: critical
    kind: command
    command: cd product && node scripts/reconciliation-smoke.mjs

  - id: gate.evidence.report
    title: Reconciliation JSON report exists
    severity: critical
    kind: file_exists
    paths:
      - agent/atm/runs/wallet-ledger-reconciliation/evidence/reconciliation-report.json

  - id: gate.evidence.package
    title: Technical evidence package complete
    severity: critical
    kind: file_exists
    paths:
      - agent/atm/runs/wallet-ledger-reconciliation/evidence/summary.md
      - agent/atm/runs/wallet-ledger-reconciliation/evidence/reconciliation-report.json
      - agent/atm/runs/wallet-ledger-reconciliation/evidence/changed-files.md
      - agent/atm/runs/wallet-ledger-reconciliation/evidence/atm-export.json
```

## 14. Evidence Package

Required files:

```text
agent/atm/runs/wallet-ledger-reconciliation/evidence/
  summary.md
  reconciliation-report.json
  changed-files.md
  api-contract.md
  invariants.md
  atm-export.json
```

No screenshots.
No demo HTML.
No visual review.

## 15. Summary Requirements

`summary.md` must answer:

- What invariant was implemented?
- What tables and write paths were inspected?
- What endpoint was added?
- What healthy scenario passed?
- What corrupted scenario was detected?
- What command gates passed?
- What is the ATM verdict?
- What remains out of scope?

## 16. Failure Rules

The run is not done if:

- typecheck fails;
- build fails;
- smoke script does not write JSON report;
- corrupted scenario is not detected;
- reconciliation endpoint returns only happy-path data;
- implementation mutates balances during a read-only reconciliation call;
- final status is claimed manually without ATM verdict;
- evidence is outside `agent/atm/runs/wallet-ledger-reconciliation/evidence`.

## 17. Acceptance Criteria

Minimum acceptable result:

- API endpoint exists and is protected.
- Reconciliation service exists.
- Healthy scenario returns balanced.
- Corrupted scenario returns non-balanced with critical issue.
- Build passes.
- Typecheck passes.
- Smoke script passes.
- ATM export exists.
- No screenshots are required.

Gold result:

- Unit tests cover signed amount calculation.
- Smoke report includes both healthy and corrupted scenario.
- Reconciliation issues are typed and severity-ranked.
- Report is deterministic and reproducible.
- ATM verdict is `demo_done` or a clearly justified non-visual equivalent if the profile uses a technical verdict.

## 18. Agent Instruction

Do not build UI.
Do not create screenshots.
Do not create demo HTML.

Use ATM. Work gate by gate. If a gate cannot be passed, block it with a reason instead of writing a success summary.

Final response must include:

- ATM verdict;
- path to `reconciliation-report.json`;
- endpoint path;
- commands that passed;
- changed files.
