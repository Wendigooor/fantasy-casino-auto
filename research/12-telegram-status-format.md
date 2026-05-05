# Telegram Status Format

## Purpose

Define a consistent update format for the agent orchestrator.

The message should be short enough to scan quickly, but rich enough to understand what is happening.

This format is intended for the `Fantasy Casino as Agentic Stress Test` heartbeat loop.

## Required fields

- task id
- current role
- current action
- file or module focus
- blocker, if any
- next step
- risk level

## Recommended template

```text
Task 51.2 | role: executor
Doing: adding admin audit logs
Focus: admin/audit + shared logging helper
Status: patch prepared, running checks
Risk: low
Next: verify output and send diff
```

## Blocked template

```text
Task 51.2 | role: planner
Doing: resolving logging location for admin actions
Blocker: logging currently split across handler and service layers
Need: choose one canonical write point
Risk: medium
Next: wait for approval before touching shared auth flow
```

## Progress heartbeat

Every 5 minutes while active, the agent should send one short update.

The update should answer:

- what changed
- what was learned
- what is next

## Screenshot trigger

Send a screenshot when one of these is true:

- the UI changed
- a terminal error is relevant
- the agent needs to show a visual confirmation
- the current state is easier to understand visually than in text

## Quality rule

If the update cannot fit into a few lines, the task is probably too broad.
