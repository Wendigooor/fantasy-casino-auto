# Taskboard Checkpoint

## Current Intent

The local agent loop should use SQLite as the single source of truth for milestones, work items,
logs, and resume hints so that each coding session can stay narrow and restart cleanly.

## What Exists

- `agent/init_db.py` now includes orchestration tables:
  - `milestones`
  - `work_items`
  - `work_item_logs`
  - `work_item_artifacts`
- `agent/taskboard.py` provides typed helpers for:
  - schema setup
  - milestone creation
  - work item creation
  - task claiming
  - status transitions
  - log writes
  - artifact attachments
  - narrow execution context building
- `agent/taskctl.py` provides CLI commands for:
  - `init`
  - `seed`
  - `next`
  - `claim`
  - `list`
  - `milestones`
  - `context`
  - `complete`
  - `needs-review`
  - `fail`
  - `block`
  - `obsolete`
  - `log`
  - `attach-artifact`
  - `create-task`
- `docs/LOCAL_AGENT_OPERATING_RULES.md` defines task sizing, status semantics, and resume rules.

## Seeded Milestone

The taskboard seeds one active milestone:

- `phase0-agent-rails`

This milestone currently contains:

- `phase0-001` — task orchestration layer
- `phase0-002` — local-agent operating rules
- `phase0-003` — fix remaining agent safety and runtime hygiene bugs

## Resume Commands

Ensure schema:

```bash
python3 agent/taskctl.py init
```

Seed starter milestone if needed:

```bash
python3 agent/taskctl.py seed
```

Emit the canonical narrow resume packet:

```bash
python3 agent/resume_task.py --json
```

See next task directly if needed:

```bash
python3 agent/taskctl.py next
```

Build narrow context for a task:

```bash
python3 agent/taskctl.py context <id>
```

Claim a task:

```bash
python3 agent/taskctl.py claim <id> --agent local-qwen
```

## Next Real Work

Continue with `phase0-003`:

- tighten executor sandboxing for delete, move, and command paths
- fix analytics event validation
- fix research summary line counts
- stop runtime artifacts from polluting source history

Verification target:

```bash
python3 -m py_compile agent/orchestrator/executor.py agent/analytics_contract.py agent/repo_summary.py
```
