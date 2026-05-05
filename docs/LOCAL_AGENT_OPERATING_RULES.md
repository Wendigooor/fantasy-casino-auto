# Local Agent Operating Rules

This file is the short execution contract for the local agent loop.
Use it together with the SQLite taskboard in `agent/plans.db`.

## Core Rules

- One execution session claims exactly one work item.
- A work item must be small enough to fit in a narrow context and one verification step.
- The agent must not write raw SQL in shell commands for task state changes.
- The agent must use `python3 agent/taskctl.py ...` for all taskboard reads and writes.
- The agent must prefer product progress over expanding agent tooling, unless the active milestone is explicitly about agent rails.

## Work Item Size

A valid work item should usually satisfy all of these:

- touches 1 to 3 files;
- has one clear outcome;
- has one verification command;
- can be summarized in 2 to 4 sentences;
- should fit into a focused coding session without rereading the whole repo.

If a requested task is larger than that, split it into subtasks first.

## Status Model

Use these statuses exactly:

- `todo`: not started yet
- `in_progress`: currently claimed by a worker session
- `blocked`: cannot continue until a dependency or decision is resolved
- `needs_review`: implementation exists and needs human or verifier review
- `done`: accepted and complete
- `failed`: attempted but failed verification or execution
- `obsolete`: no longer needed because the capability already exists or the milestone changed
- `superseded`: replaced by a newer task

## Resume Protocol

When resuming after context loss or session restart:

1. Run `python3 agent/resume_task.py --json`.
2. Use only the sources listed in that packet.
3. Read only the files listed in `scope_files` plus any directly imported dependencies.
4. Continue from `resume_hint` and recent logs instead of replaying the whole chat.
5. If the packet is insufficient, stop and report the gap instead of scanning the repo.

## Required Logs

Before leaving a work item, the agent must write at least one log entry:

- `summary` when work is complete or obsolete
- `progress` for meaningful partial work
- `blocker` when status becomes `blocked`
- `verification` after running a verification command
- `discovery` when a real follow-up task is identified

## Stale Check

Before editing code for a work item, the agent must verify whether the task is still needed.

If the capability already exists and the verification command passes, the agent should mark the
item `obsolete` instead of reimplementing it.

## Narrow Context Inputs

The default context for one work item is:

- this file
- `docs/PRODUCTION_CASINO_BUILD_INSTRUCTIONS.md`
- current milestone
- current work item
- the last 3 to 5 logs for that work item
- only the files listed in `scope_files`

Do not load broad repo context unless the work item explicitly requires it.

## Example Commands

Initialize taskboard schema:

```bash
python3 agent/taskctl.py init
```

Seed the initial milestone:

```bash
python3 agent/taskctl.py seed
```

Emit a narrow resume packet:

```bash
python3 agent/resume_task.py --json
```

Show next item:

```bash
python3 agent/taskctl.py next
```

Claim item 3:

```bash
python3 agent/taskctl.py claim 3 --agent local-qwen
```

Build execution context:

```bash
python3 agent/taskctl.py context 3
```

Mark item done:

```bash
python3 agent/taskctl.py complete 3 --message "Implemented and verified task."
```

Mark item blocked:

```bash
python3 agent/taskctl.py block 3 --message "Missing migration dependency." --resume-hint "Resume after migrations are wired."
```
