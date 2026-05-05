# MVP Plan: Autonomous Casino Build on a Personal Laptop

## Objective

Prove that a single developer can coordinate a local agent setup on a normal personal laptop and obtain a useful, satisfactory result on a large codebase-sized task, without relying on cloud coding APIs for the routine work.

This is an experiment in process, not just in software.

This MVP is the execution layer for `Fantasy Casino as Agentic Stress Test`.

## What success looks like

The experiment is successful if the system can do the following on the target laptop:

- understand a large repository in chunks
- plan work in batches instead of tiny prompts
- modify code safely without deleting files
- run tests and use failures as feedback
- keep a durable audit trail
- send progress updates through Telegram
- preserve human control over risky actions
- create material public-facing artifacts that improve your visibility and reputation

The goal is not perfect autonomy. The goal is a satisfying level of leverage.

## MVP scope

The MVP should be intentionally narrower than the full casino product.

### In scope

- local model serving
- agent orchestration
- repository indexing
- safe file editing
- test execution
- Telegram notifications
- skill bootstrap on demand
- logs and replay

### Out of scope

- real-money payments
- live provider integrations
- production compliance
- public launch
- multi-tenant access
- complicated horizontal scaling

## Recommended build sequence

### Stage 1: Read and summarize

The agent should first be able to read the repository and produce a structured understanding of it.

Deliverables:

- repository map
- page map
- data model summary
- casino runtime gap analysis
- change risk assessment

### Stage 2: Draft and patch

The agent should then be able to create a patch in a controlled workspace.

Deliverables:

- create files
- update files
- move files to quarantine instead of deleting
- preview diffs
- ask for approval on risky changes

### Stage 3: Verify

The agent should be able to run tests and report results.

Deliverables:

- test runner
- smoke checks
- linting
- structured failure summaries

### Stage 4: Close the loop

The agent should be able to connect the edit/test loop to Telegram.

Deliverables:

- task intake
- status updates
- approval prompts
- failure alerts
- completion notes

## Suggested first autonomous task types

These are low-risk and good for proving the system:

- documentation updates
- glossary expansion
- page cross-link fixes
- test additions
- markdown restructuring
- simple data-model alignment fixes

Avoid starting with:

- authentication code
- money movement code
- provider adapters
- compliance logic
- secret handling

## Operating principle

Make the agent earn more autonomy step by step.

The ladder should be:

1. read only
2. propose only
3. patch in sandbox
4. patch + test
5. patch + test + report
6. patch + test + minor follow-up
7. limited autonomy on low-risk tasks

## Core learning questions

The experiment should answer a few concrete questions:

- Can a laptop-sized setup keep a useful context window alive long enough to do work in chunks?
- Is the bottleneck model quality, memory pressure, or workflow design?
- Do skills and agent roles actually reduce repetition?
- Does the no-delete rule make the system safer without making it unusable?
- Can Telegram be an effective control surface for a one-person autonomous engineering loop?

## Minimal acceptance criteria

The MVP is useful if it can reliably complete all of these:

- inspect the repo
- identify the right files
- make a coherent multi-file change
- run a test or verification command
- log what happened
- notify the user

If it can do that, we already have something meaningful.
