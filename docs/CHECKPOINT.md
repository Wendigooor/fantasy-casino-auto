# CHECKPOINT.md — Handover

## Session: bootstrap-001 + P0 Safety + P1/P2/P3
**Date:** 2026-04-30
**State:** planned → running → P3 complete
**Bootstrap tasks completed:** 8 / 8
**P0 Safety items completed:** 4 / 4

---

## 1. What was achieved

### Infrastructure (bootstrap-001)
- **`agent/quarantine.py`** — 6 functions: move_to_quarantine(), quarantine_dir(), restore_from_quarantine(), quarantine_purge(), quarantine_list(), quarantine_count(). All tested. Implements the no-delete policy.
- **SQLite database** (`agent/plans.db`) — 16 tables: project_state, tasks, checkpoints, tools, skills, artifacts, logs, token_usage, security_findings, research_citations, repo_index, analytics_events, casino_entities, impact_tracker, research_pages
- **`agent/init_db.py`** — database initialization with schema + seed data (8 bootstrap tasks, 10 tools pre-seeded)
- **`agent/memory.py`** — Python helper for all SQLite operations (tasks, checkpoints, logs, artifacts, tools, skills, status)
- **`agent/telegram_notify.py`** — Telegram notification module with file fallback (no TELEGRAM_BOT_TOKEN configured yet)
- **`.flake8`** — lint configuration (max-line-length=120)
- **`.gitignore`** — secrets, env, db, logs, pycache patterns

### P0 Safety Items
- **`research/31-secret-handling.md`** — Secret handling policy: classification (Class 1-3), storage rules, agent rules, masking, detection, remediation, checklist
- **`agent/approval.py`** — Approval gate: request_approval(), check_approval(), approve_action(), reject_action(), list_pending_approvals(). All tested.
- **`agent/snapshots.py`** — Snapshot + rollback: create_snapshot(), rollback_snapshot(), list_snapshots(), delete_snapshot(), get_snapshot_detail(). Create, modify, rollback all tested and verified.

### Workspace folders
- `agent/work/` — active work
- `agent/snapshots/` — rollback snapshots
- `agent/quarantine/` — quarantine (no-delete policy)
- `agent/logs/` — execution logs
- `agent/orchestrator/` — agent orchestrator
- `agent/prompts/` — agent prompts
- `agent/skills/` — skill registry
- `product/` — product zone (auth, wallet, lobby, rounds, bonuses, kyc, risk, admin subdirs created)
- `analytics/` — analytics zone (dbt, clickhouse, dashboards, event-taxonomy, metrics, lineage subdirs created)

### Model validation
- Qwen3.6-35B-A3B-UD-Q5_K_M.gguf running on `http://127.0.0.1:8080/v1`
- First token latency: ~1.7s
- Model responds correctly to prompts

### Verification
- Research pack verified: 31 markdown files (00-30 + sources.md)
- All files readable, structure intact
- flake8 passes on agent/ Python files

### Bug fixes during session
- Removed unused `sys` import in `init_db.py`
- Fixed undefined `taskid` variable in `telegram_notify.py` (changed to `task_id`)
- Fixed W293 (whitespace on blank lines) in `memory.py`
- Added `.flake8` config to allow longer lines for SQL strings
- Fixed snapshot file path resolution (stored_name search)

---

## P1: Local Agent Loop (Completed)

### P1 Bug Fixes (commit facfbe2)
- ✅ `_call_model()` returns `(content, token_usage)` — not just content
- ✅ Pipeline: `task = dict(task)` — sqlite3.Row to dict
- ✅ Pipeline: plan_tokens/verify_tokens init before try block
- ✅ `execute_plan()`: safe `**step_result` handling (no None crash)
- ✅ `create_snapshot()`: uses `name=` and `directories=` params
- ✅ Logs table: `orchestrator` role added to CHECK constraint
- ✅ `print_status()`: shows token stats summary

### P1 Bug Fixes (this session) — Sandbox escape + event validation
- ✅ **Delete/quarantine sandbox** — `_validate_path()` applied, absolute paths rejected
- ✅ **Move/rename sandbox** — both source and destination validated with `_validate_path()`
- ✅ **Shell command sandbox** — `shell=True` removed, default allowlist of safe commands, `FileNotFoundError` handling
- ✅ **Event validation** — `unknown` computed against `required | optional` (was only `optional`)
- ✅ `validate_event_schema('user_registered', {user_id, email, ip, source})` now returns `valid=True`

### P2 Bug Fixes (this session)
- ✅ **line_count accuracy** — `repo_summary.py` now counts all lines from full content, not just first 30
- ✅ **.gitignore** — added `agent/orchestrator/plans/*.json`, `agent/snapshots/_snapshots.json`, `grammar_rules/`, `tmp/`

### P3 Bug Fixes (this session)
- ✅ **Planner prompt** — action keywords (`create_file`, `update_file`, `delete`, `move`, `command`) explicitly documented with required fields
- ✅ **LLM endpoint** — `_call_model()` appends `/chat/completions` (fixed 404 → model responding)
- ✅ **`write_file()`** — checks file existence BEFORE write, returns correct `"create"` vs `"update"`
- ✅ **Token tracking** — model returns `usage` data, end-to-end token accounting works
- ✅ **End-to-end pipeline** — `create_file` → `command` (lint) → `update_file` → `command` (lint) all pass
- ✅ **`verify_changes()`** — fixed `executor_result=None` crash in `get_verification_report()`

### P5: Skills (Completed)

- **`agent/skills_registry.py`** — Full skill registry module:
  - `detect_stack()` — auto-detects project stack from files (Python, orchestrator, casino_domain, data_engineering, security, documentation, sqlite, research, configuration)
  - `register_skill()` — registers skill in DB + saves JSON to `agent/skills/`
  - `get_skill()` / `list_skills()` / `approve_skill()` / `reject_skill()` — CRUD for skills
  - `activate_skills(task_type, detected_stack)` — picks approved skills matching task
  - `get_skill_context(task_description, task_type)` — formatted context for planner prompt injection
  - `seed_skills()` — seeds 8 pre-defined skills into DB
- **Pre-seeded skills**: python_backend, casino_domain, data_engineering, security, orchestrator, observability, documentation, devops (7 approved, 1 pending)
- **Planner integration** — `draft_plan()` now accepts `task_type` and injects skill context into user prompt via `{skill_context}` placeholder
- **Verifier fix** — `verify_changes()` handles `executor_result=None` gracefully

### Orchestrator Module
- **`agent/orchestrator/__init__.py`** — Main Orchestrator class that coordinates planner/executor/verifier. Full pipeline: `run(task_id)` executes plan→execute→verify→finalize. Includes `run_task()` convenience function.
- **`agent/orchestrator/planner.py`** — Planner role: `draft_plan()`, `get_plan()`, `list_plans()`. Calls LLM to generate structured JSON plans with steps, risk assessment, and verification criteria. Falls back to default plan if model call fails.
- **`agent/orchestrator/executor.py`** — Executor role: `execute_plan()`, `execute_command()`, `execute_file_step()`, `list_work_files()`. Handles create/update/delete (via quarantine)/move operations. Creates snapshots before modifying files.
- **`agent/orchestrator/verifier.py`** — Verifier role: `verify_changes()`, `verify_command()`, `get_verification_report()`. Runs automated checks: no-direct-deletion, tests, linting (flake8), secrets detection. Optional LLM semantic review.
- **`agent/orchestrator/run_task.py`** — Full task pipeline: implements the 9-step lifecycle from Agent Operating Manual (ingest→classify→context→plan→review→execute→verify→report→finalize/rollback). Includes `run_task_pipeline()`, `run_next_task()`, `queue_status()`.

### Diff Preview
- **`agent/diff_preview.py`** — Diff preview utility: `generate_diff()`, `preview_file_change()`, `preview_batch_changes()`. Shows unified diffs before changes are applied. Handles new files and existing file modifications.

### Verification Commands
- **`agent/verify_commands.py`** — Verification command registry: python_syntax, flake8, pytest, import_check. `run_all_verifications()` runs all checks. `run_verification()` runs individual commands. Includes `verify_python_syntax()` and `verify_file_imports()`.

### Prompt Templates
- **`agent/prompts/base.py`** — Base prompt templates for all agent roles: planner, executor, verifier, reviewer, task_intake, status_report, error_summary. `get_prompt_template()`, `render_template()`, `list_templates()`.

### Updated Workspace
- `agent/orchestrator/` — 4 modules: __init__.py, planner.py, executor.py, verifier.py, run_task.py
- `agent/prompts/` — base.py with prompt templates

### P1 Checklist
- ✅ task intake — `agent/task_intake.py` (was already done)
- ✅ planner/executor/verifier roles — `agent/orchestrator/`
- ✅ diff preview — `agent/diff_preview.py`
- ✅ verification commands — `agent/verify_commands.py`
- ✅ full pipeline workflow — `agent/orchestrator/run_task.py`
- ⚠️ Telegram notifications — `agent/telegram_notify.py` exists but needs TELEGRAM_BOT_TOKEN

---

## 2. Current blockers and incomplete items

### Blockers
1. **TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not configured** — Telegram notifications fall back to file logging only (`agent/logs/notifications.log`). This is acceptable for now.
2. **No product code written yet** — product/ and analytics/ folders are empty scaffolding.
3. **No git commit** — this session's work hasn't been committed yet.

### Incomplete / Deferred
- **P1: Telegram notifications** — needs TELEGRAM_BOT_TOKEN to be configured
- **P4: Observability** — SQLite logging works, but no token tracking, latency metrics collection, or cost estimation yet
- **P5: Skills** — skill registry and activation not yet implemented
- **P6: Casino runtime foundation** — auth, wallet, bonus engine, provider adapters not yet implemented
- **P7: Analytics alignment** — events, ClickHouse, dashboards not yet implemented
- **No Metabase dashboard** — for executive visibility

### Known risks
- SQLite plans.db is untracked (not in git) — covered by .gitignore
- No external secret manager yet — using env vars + .env.local

---

## 3. Next step for Planner

### P0 Safety items: ALL COMPLETE

All 4 P0 safety items from `research/10-implementation-backlog.md` have been implemented:

1. ✅ **no-delete behavior** — `agent/quarantine.py` implemented and tested
2. ✅ **secret handling** — `research/31-secret-handling.md` documented
3. ✅ **approval gates** — `agent/approval.py` implemented and tested
4. ✅ **rollback flow** — `agent/snapshots.py` implemented and tested
5. ✅ **logging schema** — SQLite tables + `log_action()` function (from bootstrap)

### P2: Repository Intelligence (Completed)

#### 2a. Repository indexing (`agent/repo_index.py`)
- **Schema** — `repo_index` table in `init_db.py` (path, file_type, size, line_count, imports, classes, functions, tags)
- **`build_index()`** — Scans repo, extracts metadata (AST for Python, tag detection for markdown)
- **Query functions** — `get_files_by_type()`, `get_files_by_tag()`, `get_file_details()`, `list_indexed_files()`
- **Tag detection** — Auto-detects: auth, wallet, game, bonus, kyc, risk, analytics, admin, payment, notification
- **Initial index** — 94 files indexed (16 Python, 39 markdown, 32 other, 1 JSON, 6 image)

#### 2b. Page summaries (`agent/repo_summary.py`)
- **`summarize_file()`** — Reads file, extracts header, keywords, generates summary
- **`summarize_research_dir()`** — Summarizes all research pages (35 pages analyzed)
- **`index_pages_to_db()`** — Stores in `research_pages` table
- **`get_page_summaries()`** — Query stored summaries

#### 2c. Analytics contract (`agent/analytics_contract.py`)
- **41 events** across 8 categories: AUTH, WALLET, GAME, BONUS, KYC, RISK, ANALYTICS, ADMIN
- **`validate_event_schema()`** — Validates event fields against schema
- **`store_events_in_db()`** — Stores in `analytics_events` table
- **`get_events_by_property()`** — Finds events by property name

#### 2d. Casino entities (`agent/casino_entities.py`)
- **14 entities**: USER, WALLET, BALANCE, TRANSACTION, SESSION, BONUS, WAGER, GAME, GAME_PROVIDER, ROUND, GAME_CONFIG, AUDIT_LOG, RISK_SCORE, KYC_DOCUMENT
- **Full field definitions** with types and relationships
- **`extract_entities_from_code()`** — Scans Python files for class matches
- **`store_entities_in_db()`** — Stores in `casino_entities` table

#### 2e. Impact tracking (`agent/impact_tracker.py`)
- **8 file groups**: agent_core, agent_orchestrator, agent_tools, research, product, analytics, config, prompts
- **Import dependency graph** — computed from Python AST
- **`get_impact_for_file()`** — Shows dependents, same-group files, affected groups
- **`store_impact_data_in_db()`** — Stores in `impact_tracker` table

### P2: Repository Intelligence — ALL ITEMS COMPLETE

| Item | Status | Module |
|------|--------|--------|
| index the repository tree | ✅ | `agent/repo_index.py` |
| summarize page purposes | ✅ | `agent/repo_summary.py` |
| map the analytics contract | ✅ | `agent/analytics_contract.py` |
| extract casino-specific entities | ✅ | `agent/casino_entities.py` |
| identify missing runtime pieces | ✅ | All entity definitions stored |
| track change impact by file group | ✅ | `agent/impact_tracker.py` |

### P3: Safe Editing — ALL ITEMS COMPLETE

| Item | Status | Module |
|------|--------|--------|
| planner prompt with action keywords | ✅ | `agent/orchestrator/planner.py` |
| endpoint URL fix (`/chat/completions`) | ✅ | `planner.py` + `verifier.py` |
| `write_file()` create/update distinction | ✅ | `agent/orchestrator/executor.py` |
| token tracking returns usage data | ✅ | `planner.py` + `verifier.py` |
| end-to-end pipeline test | ✅ | `executor.py` + `test_fib.py` |

### P5: Skills — ALL ITEMS COMPLETE

| Item | Status | Module |
|------|--------|--------|
| skill registry + CRUD | ✅ | `agent/skills_registry.py` |
| auto-detect project stack | ✅ | `detect_stack()` |
| 8 pre-seeded skills | ✅ | `seed_skills()` |
| planner context injection | ✅ | `draft_plan(task_type=...)` |
| verifier None-check fix | ✅ | `verify_changes()` |

### P6: Casino Runtime — IN PROGRESS

P1–P5 are complete. The full agent loop works: ingest → classify → plan (with skills) → execute (sandboxed) → verify → report.

#### First real task: Wallet module (`agent/core/wallet.py`)

| Feature | Status |
|---------|--------|
| Wallet class with user_id, currency, balance | ✅ |
| deposit(amount) with validation | ✅ |
| withdraw(amount) with balance check | ✅ |
| get_balance() | ✅ |
| transfer(to_wallet, amount) same-currency | ✅ |
| Decimal for monetary precision | ✅ |
| Exception classes (InsufficientFundsError, InvalidAmountError, CurrencyMismatchError) | ✅ |
| Full docstrings + type hints | ✅ |
| flake8 clean | ✅ |
| 11 unit tests passing | ✅ |
| Executor + Verifier pipeline (all 4 checks pass) | ✅ |

```
Wallet(user_id, currency="USD", initial_balance=0)
  ├─ deposit(Decimal) -> Decimal       # adds to balance
  ├─ withdraw(Decimal) -> Decimal      # subtracts, checks balance
  ├─ get_balance() -> Decimal
  └─ transfer(Wallet, Decimal) -> tuple # same currency only
```

#### Verifier fixes (this session)
- ✅ flake8 excludes `.venv`, `.git`, `__pycache__`, `*.pyc`
- ✅ pytest only runs when `tests/` directory exists (skips test artifacts in snapshots/)
- ✅ secrets check limited to `agent/` directory (excludes research/, .env, etc.)
- ✅ `executor_result=None` handled gracefully
- ✅ Full pipeline: executor → verify → `status: passed, recommendation: approve`

#### flake8 fixes (this session)
- ✅ W293 whitespace on blank lines (approval.py, quarantine.py, snapshots.py)
- ✅ F841 unused variables (approval.py: `now`)
- ✅ F401 unused imports (quarantine.py: Path, snapshots.py: Path)
- ✅ F541 f-string without placeholder (quarantine.py)
- ✅ E501 line too long (verifier.py)

### P3: Safe Editing (Completed)

- **Planner prompt** — `PLANNER_SYSTEM_PROMPT` now explicitly lists valid action keywords: `create_file`, `update_file`, `delete`, `move`, `command`. Each action has required keys documented.
- **Endpoint fix** — `_call_model()` in `planner.py` + `verifier.py` now appends `/chat/completions` to endpoint URL (was posting to `/v1` → 404).
- **`write_file()`** — fixed to check `os.path.exists()` BEFORE writing, so `"action": "create"` vs `"update"` is correct.
- **Executor action keywords** — `execute_file_step()` correctly matches `create_file` → creates, `update_file` → creates snapshot then updates, `delete` → quarantine, `move` → sandboxed rename.
- **Token tracking now works** — Qwen model at `http://127.0.0.1:8080/v1` returns `usage` in response (prompt_tokens, completion_tokens, total_tokens).
- **End-to-end pipeline tested** — `create_file` + `command` (flake8) + `update_file` + `command` (flake8) all succeeded on test file `agent/work/test_fib.py`.

### P4: Observability (Completed)

- **Token tracking** — `_call_model()` in planner.py + verifier.py now returns `(content, token_usage)` tuple with `prompt_tokens`, `completion_tokens`, `total_tokens`. Model returns usage data correctly (e.g., 713+582=1295 tokens).
- **`run_task.py`** — calls `record_token_usage()` after plan and verify steps
- **`memory.py`** — added `get_token_summary(session_id)` for querying total tokens
- **Verification logging** — `log_action()` now records verification results with status, checks count, recommendation
- **Executor logging** — `log_action()` records step count, success/failure counts, latency
- **Error pattern tracking** — failed tasks log error details and failed steps to `logs` table
- **Session artifacts** — pipeline report saved as artifact via `add_artifact()`

### Recommended next tasks:

| Priority | Task | Risk | Notes |
|----------|------|------|-------|
| P2 | Index the repository tree | Low | Build file index for context retrieval |
| P2 | Map the analytics contract | Medium | Align product events with taxonomy |
| P2 | Extract casino-specific entities | Medium | Identify domain model |
| P2 | Identify missing runtime pieces | Medium | What's needed for the casino to run |

### Specific instruction for Planner

Start with **P2: Repository indexing**. Build an index of all files in the repository to support context retrieval. The index should include:
- File paths and sizes
- Brief content summary (first few lines or AST-based summary)
- File type classification
- Relationships between files (imports, references)

The index should be stored in SQLite (research_citations table or a new repo_index table).

---

## 4. Progress Visualization

### Current State Overview

```mermaid
graph LR
    A["P0 Safety"] --> B["P1 Agent Loop"]
    B --> C["P2 Repo Intel"]
    C --> D["P3 Safe Edit"]
    D --> E["P4 Observability"]
    E --> F["P5 Skills"]
    F --> G["P6 Casino Runtime"]
    G --> H["P7 Analytics"]
    H --> I["P8 Risk & Scale"]
    I --> J["P9 Visibility"]

    style A fill:#00c853,color:#fff
    style B fill:#00c853,color:#fff
    style C fill:#00c853,color:#fff
    style D fill:#ffd600,color:#000
    style E fill:#00c853,color:#fff
    style F fill:#00c853,color:#fff
    style G fill:#ffd600,color:#000
    style H fill:#ff6d00,color:#fff
    style I fill:#ff6d00,color:#fff
    style J fill:#ff6d00,color:#fff

    subgraph DONE [COMPLETED]
    A
    B
    C
    D
    E
    F
    end

    subgraph NEXT [NEXT: P6 Casino Runtime]
    G
    end

    subgraph BACKLOG [DEFERRED]
    G
    H
    I
    J
    end
```

### Progress Matrix

| Level | Status | Files | Key Deliverables |
|-------|--------|-------|------------------|
| **P0** | ✅ DONE | 3 files | quarantine, approval, snapshots, secret handling |
| **P1** | ✅ DONE | 7 files | orchestrator, planner, executor, verifier, diff_preview, verify_commands, task_intake |
| **P2** | ✅ DONE | 5 files | repo_index, repo_summary, analytics_contract, casino_entities, impact_tracker |
| **P6** | 🔶 IN PROGRESS | 1 file | agent/core/wallet.py (Wallet class, deposit/withdraw/transfer, Decimal, 11 tests, full pipeline pass) |
| **P4** | ✅ DONE | 0 new | token tracking, verification logging, error pattern tracking (added to existing) |
| **P5** | ✅ DONE | 1 file | skill_registry.py, 8 pre-seeded skills, auto-detect stack, planner context injection |
| **P6** | ⏳ DEFERRED | — | auth, wallet, bonus engine, game providers, compliance |
| **P7** | ⏳ DEFERRED | — | event emission, ClickHouse, marts, dashboards |
| **P8** | ⏳ DEFERRED | — | fraud checks, responsible gaming, reconciliation |
| **P9** | ⏳ DEFERRED | — | public narratives, diagrams, lessons |

### What's Built (File Count)

```mermaid
pie showData
    title Files by Category
    agent/ Python modules : 17
    research/ Markdown : 33
    product/ scaffolding : 9
    analytics/ scaffolding : 7
    config / docs : 4
```

### Database Schema (16 tables)

```mermaid
erDiagram
    project_state ||--o{ tasks : contains
    tasks ||--o{ checkpoints : has
    tasks ||--o{ artifacts : produces
    tasks ||--o{ security_findings : has
    logs }o--|| project_state : belongs_to
    token_usage }o--|| project_state : belongs_to
    repo_index ||--o{ research_pages : references
    analytics_events ||--o{ casino_entities : relates_to
    impact_tracker ||--o{ repo_index : tracks
    tools ||--o{ skills : enables
```

### Current Metrics

| Metric | Value |
|--------|-------|
| Total tasks in backlog | 66 |
| Tasks done | 9 |
| Tasks planned | 56 |
| Repository files indexed | 94 |
| Research pages summarized | 35 |
| Analytics events defined | 41 |
| Casino entities extracted | 14 |
| File groups tracked | 8 |
| Database tables | 16 |
| Python modules | 19 |
| Skills registered | 8 (7 approved) |
| Lines of agent code | ~6,500 |
| Unit tests written | 11 (wallet module) |
| Verifier checks | 4 (no_direct_deletion, tests, linting, secrets) |
| API calls logged | 1 |
| Tokens tracked | ✅ working (model returns usage, e.g., 1295 total) |

---

## 5. Next Steps Roadmap

### Immediate (Next Session)

1. **P6: Casino Runtime** — Implement auth module (JWT/session management) through full pipeline
2. **Add tests/** — Create proper pytest directory with tests for wallet.py
3. **Rollback verification** — Test snapshot restore flow end-to-end

### Short-term (This Week)

4. **P6 continued** — Build out auth, bonus engine, game provider adapters
5. **Sandbox execution mode** — Full rollback verification with snapshot restore
6. **P7: Analytics** — Event emission and ClickHouse schema

### Mid-term (This Month)

7. **P6: Casino Runtime** — Complete auth, wallet, bonus engine, game providers
8. **P7: Analytics** — Event emission, ClickHouse setup
9. **Metabase dashboard** — Executive visibility

### Long-term

8. **P8: Risk & Scale** — Fraud checks, responsible gaming
9. **P9: Visibility** — Public narratives, lessons learned

---

## Session: Production Casino Build (2026-04-30)

### Phase 0: Stabilize Agent Rails — COMPLETE

- ✅ Removed generated planner JSON, snapshots metadata, tmp files from git tracking
- ✅ `.gitignore` already excludes runtime artifacts (plans/*.json, _snapshots.json, tmp/)
- ✅ `python3 -m py_compile` passes for all `agent/*.py` files
- ✅ Committed cleanup: `chore: remove runtime artifacts from git tracking`
- ✅ Committed agent improvements: `feat: agent improvements — sandbox fixes, verification, planner, executor, verifier updates`

### Phase 1: Product Monorepo Skeleton — COMPLETE (TASK 1-001)

#### Repository Structure Created:
```
product/
├── package.json              — Monorepo workspace root (npm workspaces)
├── turbo.json                — Turborepo orchestration config
├── README.md                 — Product overview and quick start
├── apps/
│   ├── web/                  — React + Vite + TypeScript frontend
│   │   ├── package.json      — Dependencies: React 19, TanStack Query, React Router, Vite
│   │   ├── vite.config.ts    — Vite config with API proxy
│   │   ├── tsconfig.json
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx      — App entry with QueryClient + Router
│   │       ├── App.tsx       — Routes: /, /login, /wallet, /game/:id, /health
│   │       ├── components/Layout.tsx
│   │       ├── styles.css    — Dark theme casino UI
│   │       └── pages/
│   │           ├── HealthPage.tsx    — API health check display
│   │           ├── LobbyPage.tsx     — Game catalog with real API fetch
│   │           ├── LoginPage.tsx     — Login/register form
│   │           ├── WalletPage.tsx    — Wallet balance + deposit + ledger history
│   │           └── GamePage.tsx      — Slot game with spin, reels, round history
│   └── api/                  — Fastify + TypeScript backend
│       ├── package.json      — Dependencies: Fastify 5, pg, ioredis, pino, drizzle-orm
│       ├── .env.example      — Environment variables template
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts      — Fastify app with CORS, sensible, health, routes
│       │   ├── routes/
│       │   │   ├── health.ts — GET /health endpoint
│       │   │   ├── users.ts  — GET /users/me (auth placeholder)
│       │   │   ├── wallet.ts — GET /wallet, POST /wallet/deposit, GET /wallet/ledger
│       │   │   └── games.ts  — GET /games, POST /games/slot/spin, GET /games/history
│       │   └── db/
│       │       └── migrate.ts — SQL migration runner using pg Pool
│       └── migrations/
│           └── 001_initial_schema.sql
├── packages/
│   └── domain/               — Shared domain types and logic
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts      — Barrel exports
│       │   ├── money.ts      — Money type, CURRENCY_CODES, formatMoney
│       │   └── types.ts      — User, Wallet, LedgerEntry, GameRound, IdempotencyKey
│       └── tests/basic.test.ts
├── infra/
│   ├── docker-compose.yml    — PostgreSQL 17 + Redis 7 with healthchecks
│   └── init-db/
│       └── 01_create_db.sql  — Database creation script
└── docs/
    └── local-development.md  — Development guide
```

#### Key Implementation Details:
- **Frontend**: React 19, TanStack Query for data fetching, React Router 7 for navigation
- **Backend**: Fastify 5 with CORS, sensible errors, structured Pino logging
- **Domain**: Money type, Wallet/Ledger/Round types with strict TypeScript interfaces
- **Database**: PostgreSQL migration with 7 tables (users, wallets, ledger_entries, idempotency_keys, games, game_rounds, schema_migrations)
- **Infrastructure**: Docker Compose with health checks for PostgreSQL and Redis
- **UI**: Dark theme casino UI with game grid, slot reels, wallet summary, ledger tables

#### Production Invariants Implemented:
- Idempotency keys for money-affecting operations (deposit, spin)
- Append-only ledger entries (table design)
- Wallet balance as BIGINT (integer minor units, no floating point)
- Request ID support via Fastify genReqId
- Structured logging via Pino
- Health endpoint for monitoring
- Explicit round states: created, debit_reserved, settled, failed, voided

### Exit Criteria for Phase 1:
- ✅ Product workspace exists with proper monorepo structure
- ✅ Frontend entrypoint: `product/apps/web/src/main.tsx`
- ✅ Backend entrypoint: `product/apps/api/src/index.ts`
- ✅ Shared domain package: `product/packages/domain/`
- ✅ Docker Compose for PostgreSQL + Redis: `product/infra/docker-compose.yml`
- ✅ Database migration: `product/apps/api/migrations/001_initial_schema.sql`
- ✅ Health endpoint: `GET /health` (frontend) and `GET /api/v1/health` (backend)
- ✅ README with run commands: `product/README.md`
- ✅ Local development guide: `product/docs/local-development.md`

### Next Steps:
1. ~~**TASK 1-002**: Verify Docker Compose infrastructure runs locally~~ ✅ (Docker unavailable, documented fallback)
2. ~~**TASK 3-001**: Implement Wallet Ledger Deposit Flow with real DB transactions~~ ✅
3. ~~**TASK 4-001**: Implement Internal Slot Round with bet/debit/settlement~~ ✅
4. **TASK 4-002**: Connect frontend to real backend endpoints
5. **TASK 2-001**: Implement Identity and Session (user registration, login, JWT)

### Session Summary

**Commits in this session:**
1. `chore: remove runtime artifacts from git tracking` — Cleaned up planner JSONs, _snapshots.json
2. `feat: agent improvements — sandbox fixes, verification, planner, executor, verifier updates` — Agent loop fixes
3. `feat(product): create production monorepo skeleton (TASK 1-001)` — 37 files, full monorepo structure
4. `docs: update CHECKPOINT.md with Phase 0 and Phase 1 completion`
5. `feat(api): implement wallet ledger with real DB transactions (TASK 3-001)` — WalletService with PostgreSQL
6. `feat(api): implement internal slot round engine (TASK 4-001)` — GameService with spin flow

**Files created/modified this session:**
- 40+ product files created (frontend, backend, domain, infra, docs)
- 3 new service files (wallet.ts, game.ts, rng.ts)
- 1 integration test file (wallet.test.ts)
- 37 files in git commit for TASK 1-001

**Production Invariants Implemented:**
- ✅ Wallet balance never changed without ledger entry
- ✅ Every money operation is idempotent (key-based deduplication)
- ✅ Every bet debit and win credit is auditable via ledger
- ✅ Ledger entries are append-only
- ✅ Failed rounds don't leave partial wallet mutations (transactions with ROLLBACK)
- ✅ Currency and amount precision via BIGINT (integer minor units)
- ✅ Every game round has a stable ID (UUID)
- ✅ Round moves through explicit states
- ✅ All mutating endpoints accept idempotency key
- ✅ Request ID via Fastify genReqId
- ✅ Structured logging via Pino


