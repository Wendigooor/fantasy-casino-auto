# Operational Protocol

This protocol defines how project work starts, pauses, resumes, and switches context. It is intended to make the project feel like an operating system with explicit state rather than an ad hoc chat history.

## Project states

The project should always be in one of the following states:

- `idle`
- `planned`
- `running`
- `paused`
- `blocked`
- `needs_review`
- `quarantine`
- `done`

## Core commands

### `start`

Use this when a new workstream should begin or when a paused workstream should be reactivated with a fresh checkpoint.

Expected behavior:
- load the current project state
- review the relevant research files first
- confirm the active workstream
- create or refresh a plan
- move the project to `running`

### `pause`

Use this when work should stop after the current safe boundary.

Expected behavior:
- finish the current safe step
- save a checkpoint
- record the next action
- move the project to `paused`
- stop new tool calls until resumed

### `resume`

Use this when the paused workstream should continue.

Expected behavior:
- read the latest checkpoint
- restore the last meaningful state
- continue from the next action rather than redoing the full context
- move the project back to `running`

### `review`

Use this when execution should stop and the result should be inspected.

Expected behavior:
- freeze execution
- run verifier and fresh-eyes review
- summarize findings and risks
- move the project to `needs_review`

### `quarantine`

Use this when a change, artifact, or path looks suspicious and should be isolated.

Expected behavior:
- move the affected item out of active flow
- preserve evidence
- stop further changes to that item until explicitly cleared

### `replan`

Use this when the current plan no longer matches reality.

Expected behavior:
- keep the existing evidence
- rebuild the plan from the latest state
- preserve what already works
- avoid restarting from zero

## Pause and resume rules

Pause must be soft. It should stop future work without destroying current state. Resume must be state-driven. It should not depend on chat recall alone.

The system should checkpoint after meaningful chunks, not after every tiny tool call. A meaningful chunk is a unit of work that can be explained, tested, or rolled back.

## Operator questions

Between sessions, the system may ask the operator short questions that are useful but not blocking. These questions should be answerable or ignorable. If there is no answer, the system should keep moving using the best available assumptions and leave the question open.

## Review modes

There are two review modes.

The first is the bounded verifier, which checks implementation quality, tests, and regressions.

The second is the fresh-eyes review model, which may be unconstrained in tone and reasoning style but is still read-only. Its job is to challenge the final outcome and expose blind spots.

## Human ergonomics

The operator should be able to manage the project with a small set of intuitive actions:

- start
- pause
- resume
- review
- replan
- quarantine
- status

If the control surface becomes more complicated than the work itself, the system has failed the ergonomics test.
