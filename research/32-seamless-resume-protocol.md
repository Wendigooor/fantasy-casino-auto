# Seamless Resume Protocol

## Purpose

Define how the agent resumes work after a session is closed or interrupted.
This protocol ensures zero context loss between sessions.

---

## Core Principle

**State is persisted in three independent layers. No session should ever start without all three being available.**

---

## Three Layers of Persisted State

### Layer 1: CHECKPOINT.md

The primary handover document. Updated at the end of every meaningful work session.

Must contain:
- **What was achieved** — files created/modified, functions implemented, tests run, bugs fixed
- **Current blockers** — what is blocking progress (missing tokens, external dependencies, design decisions)
- **Incomplete/Deferred items** — what was planned but not started, or started but abandoned
- **Next step** — specific, actionable next task with priority and risk assessment
- **Specific instruction for Planner** — explicit guidance for the next session, including which file to read first

**Rule:** CHECKPOINT.md must be updated before any session ends. If a session produces output, it is written to CHECKPOINT.md. If CHECKPOINT.md is not updated, the session is considered incomplete.

### Layer 2: SQLite `agent/plans.db`

The structured state database. Always reflects the current reality of the project.

Key tables for resume:
- `tasks` — status, priority, risk, phase, timestamps. Query `WHERE status = 'planned'` to find next work.
- `checkpoints` — metadata about each checkpoint (task_id, project_state, summary, changed_files, next_step, blockers, tool_set)
- `logs` — chronological record of every action. Session ID links related actions.
- `artifacts` — files produced during execution with task associations.
- `project_state` — high-level state keys (current_state, session_id, started_at)

**Resume procedure:**
1. Connect to `plans.db`
2. Call `memory.get_status_summary()` for a compact overview
3. Query tasks by status to find the next actionable item
4. If any task is `running`, load its last checkpoint from the `checkpoints` table
5. Load recent logs for the task's session to reconstruct context

### Layer 3: File System

The persistent filesystem state. Everything written during a session survives.

Critical directories:
- `agent/work/` — active work in progress. Contains task-specific subdirectories with created/modified files.
- `agent/snapshots/` — rollback points. Each snapshot stores file content before modification.
- `agent/quarantine/` — files that were removed from active use (no-delete policy).
- `agent/orchestrator/plans/` — saved JSON plans from the planner. Each plan is a self-contained JSON file.
- `agent/logs/` — execution logs, notification logs.
- `agent/prompts/base.py` — prompt templates used by all roles.
- `research/` — all research markdown files. First-class context for the agent.

**Resume procedure:**
1. Check `agent/work/` for active task directories (format: `YYYYMMDD_HHMMSS/`)
2. Check `agent/snapshots/` for available rollback points
3. Check `agent/orchestrator/plans/` for the latest plan
4. List files in `research/` to identify relevant context documents

---

## Resume Procedure (Step by Step)

When a new session starts, the agent must:

### Step 1: Read CHECKPOINT.md

Load and read `CHECKPOINT.md` from the project root.
Identify:
- Last completed session state
- What was achieved
- Known blockers
- Recommended next step

### Step 2: Validate Against Database

Connect to `agent/plans.db` and call `memory.get_status_summary()`.

Compare the summary with CHECKPOINT.md:
- Do the task counts match?
- Is the next_task the same?
- Are there any `running` tasks that CHECKPOINT.md says are `done`?

If there is a mismatch, the CHECKPOINT.md is stale. Reconcile by trusting the database (it is the source of truth).

### Step 3: Check Active Work

Look for directories in `agent/work/`:
```
agent/work/
  20260430_143022/   ← task-specific work
  20260430_160045/   ← another task
```

If there are active work directories, load the latest one and check if its associated task is still `running` in the database.

### Step 4: Load Recent Checkpoints

For any `running` task:
```python
from agent.memory import get_conn, get_last_checkpoint

conn = get_conn()
checkpoint = get_last_checkpoint(conn, task_id)
# checkpoint contains: project_state, summary, changed_files, next_step, blockers, tool_set
```

This provides the last known good state for the task.

### Step 5: Load Relevant Research

Apply the context policy from `research/09-agent-manual.md`:
- Read the relevant pack files before introducing new ideas
- Check whether an idea already exists before duplicating it
- Update the canonical file when a decision changes

For resume, load the research files referenced in CHECKPOINT.md and the current task's phase.

### Step 6: Reconcile and Decide

Based on all three layers, decide:
- **If a task is running:** resume from the last checkpoint. Load the plan, restore the work directory state, continue where it left off.
- **If a task is planned:** start fresh. Read the task description, load context, run the planner.
- **If a task is paused/blocked:** read the blocker description from the database. Resolve the blocker if possible, or continue with a different task.
- **If all tasks are done:** check if new research or product work should be started.

### Step 7: Update CHECKPOINT.md

After resuming and taking action, update CHECKPOINT.md immediately. The update should include:
- What was resumed from
- What was attempted
- What changed
- What the new next step is

If the session ends, CHECKPOINT.md must reflect the most up-to-date state.

---

## Example Scenarios

### Scenario A: Clean Resume (No Interruption)

```
CHECKPOINT.md says: P1 Local Agent Loop — all complete.
Database says: 56 planned tasks, 0 running.
Work directory: empty.

Decision: Start P2: Repository Intelligence.
```

### Scenario B: Interrupted Task

```
CHECKPOINT.md says: P2 task #23 "Index repository tree" — running.
Database says: task #23 status=running, last checkpoint at step 3/7.
Work directory: contains `20260430_160045/` with partial index.

Decision: Resume task #23 from checkpoint. Load the partial index,
continue from step 4, preserve existing work.
```

### Scenario C: Stale CHECKPOINT.md

```
CHECKPOINT.md says: task #23 is planned.
Database says: task #23 is running, started 2 hours ago.
Work directory: contains active work for task #23.

Decision: Trust the database. CHECKPOINT.md is stale.
Resume task #23 from latest checkpoint, then update CHECKPOINT.md.
```

### Scenario D: Multiple Running Tasks

```
Database says: task #23 is running, task #25 is running.
CHECKPOINT.md only mentions task #23.

Decision: Trust the database. Load checkpoints for both tasks.
If both are from the same session, resume in order of task_id.
If from different sessions, resume the older one first (long-running).
```

---

## Emergency Recovery

If CHECKPOINT.md is missing or corrupted:

1. **Trust the database** — it is the source of truth.
2. Call `memory.get_status_summary()` to get the current state.
3. Load all `running` tasks from `tasks` table.
4. Load the last checkpoint for each running task.
5. Scan `agent/work/` for active directories.
6. Reconstruct the state from these three sources.
7. Create a new CHECKPOINT.md from scratch based on the reconstruction.

If the database is also missing:

1. The project has no persisted state.
2. All work must be redone or recovered from the file system.
3. Scan `research/` for any saved plans.
4. Scan `agent/work/` for active work.
5. Start fresh — read `research/README.md` and `research/09-agent-manual.md` for context.

---

## Update Contract

After each meaningful chunk of work, the agent MUST:

1. Update CHECKPOINT.md with:
   - What was attempted
   - What actually changed (file paths, function signatures, test results)
   - What evidence was produced (test output, logs, diffs)
   - What failed or was uncertain
   - What was learned
   - Whether the result improved speed, safety, visibility, or reuse

2. If a checkpoint was taken, ensure the checkpoint has:
   - `summary` — one-line description of progress
   - `next_step` — what to do next
   - `blockers` — what is preventing progress (or empty string)
   - `tool_set` — what tools are active

3. If a plan was executed, ensure it was saved in `agent/orchestrator/plans/`.

4. If a task was completed, updated, or blocked, the database reflects the current state.

5. Run `memory.print_status()` to verify the database is consistent.

---

## Checklist for Session End

Before ending a session, verify:

- [ ] CHECKPOINT.md is updated
- [ ] All running tasks have a checkpoint
- [ ] All plans are saved to `agent/orchestrator/plans/`
- [ ] Database status matches CHECKPOINT.md summary
- [ ] `memory.print_status()` runs without errors
- [ ] No secrets in output, logs, or untracked files
- [ ] All new files are in their correct directories

---

## Rules

1. **Never skip CHECKPOINT.md updates.** It is the single most important document in the project.
2. **Never trust a stale CHECKPOINT.md.** Always validate against the database.
3. **The database is the source of truth.** CHECKPOINT.md is the human-readable summary.
4. **If in doubt, trust the filesystem.** Files on disk are the final record of what was actually written.
5. **Resume is free.** With this protocol, any session can pick up where another left off with zero context loss.
