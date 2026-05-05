# Reuse Layer: Tool Registry, Skills, Memory, and State

## Goal

Prevent the system from recreating tools, prompts, and workflows on every small task.

The system should instead learn once, store once, and reuse many times.

## Core layers

### 1. Tool Registry

This is the catalog of available capabilities.

Each tool entry should include:

- name
- purpose
- inputs
- outputs
- safety class
- cost characteristics
- when to use
- when not to use
- owner
- version

The orchestrator should always consult the registry before deciding to create a new tool.

## 2. Skill Registry

This is the catalog of reusable workflows.

Each skill entry should include:

- name
- trigger condition
- short description
- required tools
- expected output
- known limitations
- review status

Skills should be created when a pattern repeats.

Examples:

- repository indexing
- diff summarization
- test triage
- Telegram heartbeat generation
- security red-team review
- context pruning

## 3. Memory Layer

This is where durable state lives.

Recommended split:

- `SQLite` for fast local state and experiment history
- optional `Postgres` later if the system becomes collaborative or needs heavier reporting
- embeddings only for retrieval, not as the only source of truth
- prompt cache for repeated context, but not as the sole memory system

## 4. Artifact Store

This stores the durable evidence of work.

Artifacts include:

- plans
- diffs
- screenshots
- logs
- benchmark results
- postmortems
- completed research notes

Artifacts should be referenced by the memory layer, not replaced by it.

## 5. Context Selector

This is the layer that decides what to load for a task.

It should pick:

- relevant docs
- relevant past decisions
- relevant tools
- relevant skills
- relevant artifacts

It should not rehydrate the entire universe every time.

## 6. Checkpointing

Every meaningful execution chunk should create a checkpoint.

Checkpoint contents:

- task id
- current state
- changed files
- pending blockers
- current tool set
- next step

## 7. Source of Truth Rules

Your preferred stance is that the source of truth is everything together.

That can work if precedence is explicit:

1. git for code and diffs
2. SQLite/Postgres for structured task state
3. Telegram for live communication and decisions
4. research docs for durable strategy and learnings
5. artifacts for evidence

## How Hermes-like systems usually solve this class of problem

The key trick is not “rebuild on every turn”.
The key trick is:

- keep tools persistent
- keep skills reusable
- keep memory structured
- keep context selective
- keep evidence durable

That is how you avoid a system that keeps inventing the same screwdriver.

