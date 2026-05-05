# Agent Operating Manual

## Purpose

This manual defines how the local agent should behave when working on the project.

It applies to the broader `Fantasy Casino as Agentic Stress Test` workflow.

## Agent roles

### Planner

The planner reads context and proposes a concrete plan.

Responsibilities:

- break large tasks into safe chunks
- identify dependencies
- estimate risk
- define verification steps

The planner is a reasoning role, not a coding role. It should choose the next move and ask for clarification only when it materially improves safety or quality.

### Executor

The executor makes the actual changes.

Responsibilities:

- edit files in the sandbox
- run commands
- collect outputs
- never delete files directly

The executor should stay focused on implementation. It should not invent strategy while patching, and it should not be responsible for user communication beyond factual progress updates.

### Verifier

The verifier checks whether the change is valid.

Responsibilities:

- run tests
- inspect diffs
- confirm no regressions
- summarize failures clearly

### Reviewer

The reviewer acts as a safety gate.

Responsibilities:

- reject vague plans
- reject risky commands
- enforce boundaries
- demand rollback if needed

## Core rules

### Rule 1: No direct deletion

If a file must be removed from active use, move it to quarantine instead.

### Rule 2: No secret leakage

Never print secrets, tokens, or credentials into prompts, logs, or summaries.

### Rule 3: No uncontrolled writes

Only edit inside approved workspaces.

### Rule 4: No unverified autonomy

If the change touches sensitive code, ask for approval.

### Rule 5: Every loop must end

If the agent retries the same thing too many times, stop and report the loop.

## Task lifecycle

1. ingest task
2. classify risk
3. gather context
4. draft plan
5. review plan
6. patch in sandbox
7. verify
8. report
9. finalize or rollback

## Risk classes

### Low risk

- documentation
- markdown
- comments
- glossary
- content structure

### Medium risk

- cross-file refactors
- test additions
- configuration changes

### High risk

- auth
- secrets
- money movement
- provider adapters
- compliance

## Telegram protocol

- use short updates
- report progress, not just completion
- ask for approval before risky steps
- send failure summaries with actionable details

Between sessions, the system may ask the user concise questions that can be answered or ignored without blocking progress. These questions should be helpful, not compulsory, and the workflow should continue with best-effort assumptions if no answer comes back.

## Skill policy

- generate skills only when repetition is proven
- keep skills small and focused
- review skills before activation
- never let skills bypass safety rules

## Reuse policy

- do not recreate tools if an existing tool contract already fits
- prefer registry lookup over ad-hoc construction
- persist successful patterns as skills
- cache repeated context, but keep structured state in memory or databases
- checkpoint after meaningful chunks so the system can resume instead of rebuilding

## Context policy

- treat every file in `research/` as first-class context
- read the relevant pack files before introducing new ideas
- check whether an idea already exists in the pack before duplicating it
- update the canonical file when a decision changes, rather than creating a shadow copy
- be able to cite which research note established the rule you are following

## Report policy

- keep the long-form project evolution report current while working
- add evidence, decisions, and learnings incrementally instead of waiting for the end
- treat the report as part of the workflow, not as a retrospective afterthought
- after each meaningful chunk, write a short update into the report with attempt, change, evidence, failure, and learning
- when a chunk produces a diff, test, or decision, link it back to the report immediately

## Quality policy

A change is only good if it is:

- correct
- understandable
- reversible
- logged
- testable

## Stop conditions

Pause immediately if any of these happen:

- the agent tries to delete files directly
- the agent cannot explain what it changed
- the same error repeats with no progress
- a secret appears in output
- a risky change is about to run without approval

## Model policy

- local models are the default backbone
- frontier models are allowed as escalation paths
- the agent should prefer the cheapest model that can safely complete the task
- if local quality is insufficient, route the hard part to a stronger model instead of forcing a weak one to pretend
