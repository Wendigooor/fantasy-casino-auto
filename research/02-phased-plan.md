# Phased Delivery Plan

## Phase 0: Scope and guardrails

Duration: 1-2 days

Goal: define what the system is allowed to do.

This plan is part of the broader `Fantasy Casino as Agentic Stress Test` experiment. The point is to prove that a personal laptop can support meaningful autonomous engineering on a realistic, high-stakes domain.

Deliverables:

- task boundaries
- approval rules
- no-delete rule
- network policy
- secret policy
- rollback policy
- telemetry schema

Exit criteria:

- the agent can be explained to another person in one page
- the agent cannot delete files directly
- the agent cannot read secrets directly

## Phase 1: Local baseline

Duration: 3-5 days

Goal: make a single local agent work end to end on a safe sample task.

Deliverables:

- local model serving
- task intake from Telegram or a local queue
- read-only repository indexing
- one editor agent
- one verifier agent
- command logging
- basic test execution

Exit criteria:

- the agent can read the repo
- propose a change
- create a patch in a sandbox
- run tests
- report results back

## Phase 2: Controlled file operations

Duration: 3-7 days

Goal: allow edits, but keep blast radius small.

Deliverables:

- workspace snapshots
- quarantine folder for moved files
- diff previews
- approval gate for risky file operations
- command denylist / allowlist

Exit criteria:

- no direct deletions
- every change is reproducible
- every patch can be rolled back

## Phase 3: Skill bootstrap

Duration: 2-4 days

Goal: add skills only when the project truly needs them.

Deliverables:

- stack detection
- skill installer wrapper
- skill allowlist
- generated skill review flow
- skill registry

Exit criteria:

- repeated tasks can be promoted into reusable skills
- no unreviewed skills are activated

## Phase 4: Observability and economics

Duration: 2-5 days

Goal: understand whether the system is actually efficient.

Deliverables:

- inference log database
- dashboards for TTFT, TPS, token burn, and cache hit rate
- test success metrics
- cost-per-task estimates
- failure classification

Exit criteria:

- the system can explain where time and tokens are going
- repeated loops are visible
- expensive tasks are obvious

## Phase 5: Partial autonomy

Duration: ongoing

Goal: allow low-risk tasks to run with minimal supervision.

Allowed tasks:

- documentation updates
- small refactors
- test additions
- glossary updates
- harmless content generation

The autonomy target is not “the agent does everything”. The target is “the agent can safely handle large chunks, while the human owns risk and direction”.

Still gated tasks:

- changes to security-sensitive code
- changes to secrets handling
- changes to deployment pipelines
- any potentially destructive filesystem action

## Success metrics

- task success rate above 80% on low-risk work
- patch acceptance rate above 70%
- test pass rate above 90% for routine tasks
- no secret leakage
- zero direct deletions
- predictable token spend
- stable local runtime under sustained use

## Major risks to watch

1. Memory pressure from large context windows and browser sessions.
2. Agent loops that repeat the same failing action.
3. Skill sprawl that makes the system harder to understand.
4. Over-trusting “auto-evolving” behavior before the telemetry is mature.
5. Underestimating how much human review is still needed for risky changes.

## Open questions

- Which local model is the best balance of quality and speed on the target Mac?
- Which tasks should be fully autonomous and which should always require approval?
- Should Telegram be only a notification layer, or also the primary command surface?
- Is browser automation needed in v1, or can we start with repo-only tasks?
- Should memory live in SQLite first or go straight to Postgres?
