# Fantasy Casino Project Evolution Report

## 1. Executive Summary

**Experiment:** Fantasy Casino as Agentic Stress Test  
**Goal:** Prove that a local agent stack on a personal laptop can plan, implement, verify, document, and explain meaningful engineering work with enough safety and observability to be worth scaling.  
**Framing:** Casino-shaped Rails stress test for autonomous software development, not a real-money gambling product.

## 2. Why This Project

The project tests whether a single developer can coordinate a local agent and obtain a satisfying result on a large codebase task without relying on cloud coding APIs for routine work. It matters for engineering leadership and visibility by producing concrete proof of a measurable, repeatable AI engineering operating model.

## 3. Starting Assumptions

- A laptop-sized setup can keep useful context alive in chunks
- The bottleneck is workflow design, not model quality
- Skills and roles reduce repetition
- No-delete rule improves safety without breaking usability
- Telegram can be an effective control surface for one-person autonomous loops

## 4. System Design Evolution

### Session: bootstrap-001 (2026-04-30)

**Initial state:** 31 research documents in `research/`, no product code, no agent code, no database.

**Evolution during this session:**

1. **Database layer created** — SQLite with 10 tables following the instrumentation stack doc (`22-instrumentation-and-control-stack.md`, section 7). Tables: project_state, tasks, checkpoints, tools, skills, artifacts, logs, token_usage, security_findings, research_citations.

2. **Workspace structure created** — product/, analytics/, agent/ zones per `repo-spec.md` (`07-repo-spec.md`). Sub-folders for work, snapshots, quarantine, logs, orchestrator, prompts, skills.

3. **Model runtime validated** — Qwen3.6-35B-A3B-UD-Q5_K_M.gguf responding on `http://127.0.0.1:8080/v1`, first token ~1.7s.

4. **Telegram module created** — with file logging fallback when TELEGRAM_BOT_TOKEN is not configured.

5. **Lint pipeline established** — .flake8 config, flake8 passes on agent/ Python files.

6. **All actions logged to SQLite** — every meaningful operation recorded with role, action, details, output, success flag, latency.

## 5. Execution Timeline

### bootstrap-001 — Day 1

| Time | Action | Outcome |
|------|--------|---------|
| Init | Created SQLite schema + seed data | `agent/plans.db` with 10 tables, 8 bootstrap tasks, 10 tools |
| Step 1 | Prepared workspace folders | agent/work, snapshots, quarantine, logs; product/, analytics/ |
| Step 2 | Validated model runtime | Qwen3.6 responding, 1.7s first token |
| Step 3 | Telegram module created | File fallback working, needs TELEGRAM_BOT_TOKEN |
| Step 4 | Repo indexed | 31 research docs verified, structure intact |
| Step 5 | Safe editing defined | No-delete policy documented, quarantine folder ready |
| Step 6 | Verification defined | flake8 lint pipeline established |
| Step 7 | Observability defined | SQLite logging, token tracking tables, log_action() function |
| Step 8 | First real task | Verified research pack, fixed lint issues, logged everything |
| P0 #1 | Quarantine module | `agent/quarantine.py` — 6 functions, tested move/restore/purge |
| P0 #2 | Secret handling | `research/31-secret-handling.md` — classification, rules, detection, remediation |
| P0 #3 | Approval gate | `agent/approval.py` — request/check/approve/reject, tested |
| P0 #4 | Snapshots | `agent/snapshots.py` — create/rollback/list/delete, tested |

### Artifacts produced
- `agent/plans.db` — SQLite database (10 tables, 8 tasks completed)
- `agent/init_db.py` — database initialization script
- `agent/memory.py` — Python helper for all SQLite operations
- `agent/telegram_notify.py` — Telegram notification module
- `.flake8` — lint configuration
- `docs/CHECKPOINT.md` — handover checkpoint
- `agent/{work,snapshots,quarantine,logs,orchestrator,prompts,skills}/` — workspace folders
- `product/{auth,wallet,lobby,rounds,bonuses,kyc,risk,admin}/` — product scaffolding
- `analytics/{dbt,clickhouse,dashboards,event-taxonomy,metrics,lineage}/` — analytics scaffolding

## 6. Evidence Trail

- `research/` — 31 documents (source of truth for strategy)
- `agent/plans.db` — structured task state, checkpoints, logs, artifacts
- `agent/init_db.py` — seed data with bootstrap tasks from `08-bootstrap-checklist.md`
- `docs/CHECKPOINT.md` — handover summary
- `agent/logs/` — notification log fallback
- flake8 passes clean on agent/ Python files

## 7. What Went Well

- **SQLite for state** — durable, queryable, resumable. No file sprawl.
- **Pre-seeding tasks** — bootstrap checklist tasks loaded directly into SQLite, no manual entry needed.
- **Telegram fallback** — file logging when no token configured keeps the system functional.
- **Research pack integrity** — all 31 files verified, no missing or corrupted docs.
- **Tool registry pre-seeded** — 10 tools from the instrumentation stack already in the database.

## 8. What Went Wrong

- **flake8 errors discovered** — 3 files had issues (unused import, undefined variable, whitespace on blank lines). All fixed, but revealed the need for a `.flake8` config with appropriate line length.
- **No local model runner installed** — ollama, LM Studio, etc. not present. Model is served via external endpoint. Need to confirm this is the intended setup or install a local runner.
- **SQLite .db file untracked** — needs `.gitignore` entry.
- **Telegram not configured** — falls back to file logging. Not blocking, but limits the "control surface" goal.

## 9. Economics and Speed

- **Model:** Qwen3.6-35B-A3B, first token ~1.7s, running on external endpoint
- **No cloud API costs** — local model serving
- **SQLite overhead:** negligible
- **Session time:** estimated ~30 minutes for full bootstrap (all 8 tasks)
- **Token usage:** not yet tracked (no token tracking module implemented yet)

## 10. Reusable Learnings

1. **SQLite + Python helper** — pattern for all future sessions. `agent/memory.py` provides all CRUD operations for tasks, checkpoints, logs, artifacts.
2. **Pre-seed everything** — tools, skills, bootstrap tasks should be loaded from the init script, not created manually.
3. **Telegram fallback** — always have a file logging fallback. Don't block on external dependencies.
4. **.flake8 config** — 120 char line length, ignore E203, ignore F401 in `__init__.py`. Apply to all Python code.
5. **Research pack as source of truth** — every decision should cite a research doc number.
6. **SQLite for P0 safety** — quarantine, approval, snapshots all stored in SQLite via agent/memory.py
7. **stored_name approach for snapshots** — files stored with hash-based unique names, searched by name via walk
8. **Telegram fallback pattern** — file logging when TELEGRAM_BOT_TOKEN unavailable, works seamlessly

## 11. Hard Truths

- The research pack is 32 documents of planning (plus P0 policy docs). Zero lines of product code. Planning density is very high.
- SQLite is useful, but without a proper orchestrator, tasks are just rows in a database — nobody reads them except the agent itself.
- The model works but 1.7s first token latency means even simple tasks take time. Autonomy at this speed feels slow.
- Telegram is the stated control surface, but without a bot token, it's just a file. The system works without it, but the visibility goal is weakened.
- No git commits yet. All work is in working tree state. If something goes wrong, there's no recovery point.
- P0 safety functions work in isolation but have no orchestrator to call them — they need integration with the agent loop.

## 12. Conclusion

**What was proved in this session:**
- A SQLite-based state system can be initialized with seed data from research documents
- Workspace folders can be scaffolded across 3 zones (product, analytics, agent)
- Model runtime can be validated and latency measured
- All bootstrap checklist items can be executed and logged
- A handover checkpoint can be created with achievements, blockers, and next steps
- P0 safety items can be fully implemented and tested: quarantine, approval gate, snapshots, secret handling policy

**What was not proved:**
- Can the agent plan and execute tasks autonomously without human guidance? (not tested yet)
- Does the no-delete rule actually work in practice? (quarantine works, but not integrated into agent loop)
- Does Telegram as a control surface improve the workflow? (not configured)
- Can the system recover from a checkpoint after being stopped? (snapshots work, but not tested in production)
- Do approval gates actually prevent risky actions? (approval module works, but no orchestrator to enforce it)

**What should happen next:**
Start with P1: Local Agent Loop. First concrete task: create task intake mechanism. See `docs/CHECKPOINT.md` for detailed next steps.

---

## P0 Safety Summary (completed in this session)

| # | Item | Implementation | Status |
|---|------|---------------|--------|
| 1 | No-delete behavior | `agent/quarantine.py` — 6 functions | ✅ Tested |
| 2 | Secret handling | `research/31-secret-handling.md` | ✅ Documented |
| 3 | Approval gates | `agent/approval.py` — 5 functions | ✅ Tested |
| 4 | Rollback flow | `agent/snapshots.py` — 5 functions | ✅ Tested |
| 5 | Logging schema | SQLite + `agent/memory.py` | ✅ Working |
