# Repository-Level Spec

## Purpose

This document defines how the casino experiment and the local-agent experiment should live together in one repository without becoming a confusing mix of concerns.

This repo structure is aligned to the `Fantasy Casino as Agentic Stress Test` framing.

## Recommended separation

The repo should be divided into three conceptual zones:

### 1. Product zone

Contains the actual casino runtime:

- auth
- wallet
- lobby
- games
- rounds
- bonuses
- KYC
- risk
- admin

### 2. Analytics zone

Contains the operational truth already described by the existing pages:

- data model
- event taxonomy
- metrics
- dashboards
- lineage
- governance
- incident response

### 3. Agent zone

Contains the local autonomous developer system:

- model runtime
- task queue
- Telegram integration
- skills
- logs
- snapshots
- quarantine/trash handling

## Suggested folder structure

```text
/
  product/
    auth/
    wallet/
    lobby/
    rounds/
    bonuses/
    kyc/
    risk/
    admin/
  analytics/
    dbt/
    clickhouse/
    dashboards/
    event-taxonomy/
    metrics/
    lineage/
  agent/
    orchestrator/
    prompts/
    skills/
    logs/
    snapshots/
    quarantine/
  research/
  pages/
  files/
  assets/
```

## Boundary rules

### Product zone rules

- may change application logic
- may change database schemas
- may emit events
- may not touch agent runtime internals

### Analytics zone rules

- may consume product events
- may transform data
- may publish reports
- may not mutate operational balances

### Agent zone rules

- may edit files in approved workspaces
- may move files to quarantine
- may generate skills under approval
- may not directly alter production secrets or money logic

## Data contracts

The product zone should emit events that match the analytics zone contract.

Examples:

- `player_registration_completed`
- `player_deposit_completed`
- `player_bet_placed`
- `player_bet_settled`
- `player_bonus_issued`
- `player_kyc_completed`

These are already reflected in the repository’s event taxonomy and data model, so the implementation should align with them rather than invent new names.

## Agent workflow contract

The agent should work in this sequence:

1. detect task
2. load relevant context
3. propose plan
4. create patch in sandbox
5. run verification
6. summarize result
7. ask for approval if needed
8. either finalize or quarantine changes

## Safety contract

### No-delete policy

Deletion is replaced by movement into quarantine.

### Approval policy

Risky operations require human approval before execution.

### Secrets policy

Secrets must be injected through a secret manager, never pasted into prompts.

### Logging policy

Every meaningful action must be logged with enough context for replay.

## Practical implementation advice

Do not try to make the repository fully self-modifying.

Instead:

- keep agent code separate from product code
- keep generated skills separate from hand-written skills
- keep experimental workspaces separate from stable workspaces
- keep audit artifacts separate from source

That separation is what makes the experiment manageable on a normal laptop.

## Narrative rule

The agent zone should support your visibility goal by making the work easy to explain externally:

- what was attempted
- what was changed
- what was learned
- what failed
- what became reusable
