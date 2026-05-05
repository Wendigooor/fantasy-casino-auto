# Implementation Backlog

This backlog is prioritized for `Fantasy Casino as Agentic Stress Test`.

## P0: Safety and control

These are the first tasks.

- create active work, snapshot, and quarantine folders
- define no-delete behavior
- define approval gates
- define secret handling
- define logging schema
- define rollback flow

## P1: Local agent loop

- start one local model reliably
- create task intake
- add planner/executor/verifier roles
- connect Telegram notifications
- add diff preview
- add verification commands

## P2: Repo intelligence

- index the repository tree
- summarize page purposes
- map the analytics contract
- extract casino-specific entities
- identify missing runtime pieces
- track change impact by file group

## P3: Safe editing

- create files in sandbox
- update files in sandbox
- move files to quarantine
- generate patch previews
- preserve rollback snapshots

## P4: Observability

- record token usage
- record latency
- record command outputs
- record verification results
- record error patterns
- store session artifacts

## P5: Skills

- detect project stack
- install only relevant skills
- generate a skill registry
- review generated skills
- activate approved skills

## P6: Casino runtime foundation

These are product tasks, not agent tasks.

- define auth and session model
- define wallet ledger
- define bonus engine
- define game provider adapter interface
- define compliance state machine
- define audit log

## P7: Analytics alignment

- align product events with taxonomy
- implement event emission
- populate ClickHouse analytics
- build marts
- wire dashboards
- validate metric definitions

## P8: Risk and scale

- add fraud checks
- add responsible gaming controls
- add reconciliation jobs
- add incident handling
- add reconciliation dashboards
- prepare for multi-user collaboration

## P9: Visibility and reputation

- turn technical milestones into Slack-ready insights
- prepare short public narratives for what was learned
- produce diagrams and screenshots that explain the system
- extract reusable lessons into posts or internal talks

## Priority rule

Never work on a lower-priority item if a higher-priority safety item is still missing.
