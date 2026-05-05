# Planning and Visibility Automation

This document describes how planning should work in a fast AI-assisted environment where traditional roadmaps are too slow to stay useful if they are treated as static artifacts.

## Core idea

Planning should not be a static ceremony. It should be a live visibility system that helps people understand what is happening, what is blocked, what is likely next, and where the real risk sits.

The goal is not to eliminate planning. The goal is to automate the expensive parts of planning, reduce manual status churn, and keep the plan close to execution reality.

## What planning should become

Planning should answer four questions:

- what is being worked on now
- what is the next smallest useful chunk
- what is blocked or risky
- what evidence proves progress

If a roadmap cannot answer those questions, it is mostly theater.

## Why current roadmaps often fail

Traditional roadmaps become stale because they are built as static promises instead of adaptive control surfaces. In an AI-accelerated workflow, the useful unit of planning is smaller, faster, and more evidence-based than a quarterly slide deck.

The right response is not to stop planning. It is to move planning closer to the work and make it refresh automatically.

## Automation options

### 1. Auto-generated status map

The system can generate a live summary from:
- current state
- open tasks
- recent diffs
- test results
- blockers
- risk annotations

This becomes the visible “what is happening now” layer.

### 2. Evidence-backed roadmap

The roadmap should be built from actual artifacts:
- patches
- tests
- screenshots
- review notes
- benchmarks

Instead of saying “Q2 feature delivery,” the roadmap can say “sandbox, observability, reuse layer, security role, benchmark harness, feature slice.”

### 3. Workstream dashboard

Each workstream should have a dashboard showing:
- state
- owner role
- last update
- next step
- risk level
- review status

This is much more useful than a static milestone chart.

### 4. Milestone synthesis

The system can periodically synthesize milestone-level planning from execution data. That means the roadmap is not manually rewritten from scratch; it is distilled from what the agent system already knows.

### 5. Decision log to roadmap bridge

When a decision changes the direction of the work, the system should update the relevant roadmap layer automatically. This prevents the situation where execution and planning diverge for weeks.

## Recommended planning stack

The best default is:

- `SQLite` for durable state
- `Markdown` for human-readable plans
- `Telegram` for live heartbeat and operator visibility
- `Metabase` for dashboards
- `Langfuse` or `Phoenix` for traces and economics
- `checkpointing` for reproducibility

## Planning modes

### Tactical planning

Short-horizon and execution-close. This should be refreshed frequently and can be mostly automated.

### Milestone planning

Medium-horizon and milestone-oriented. This should be synthesized from tactical execution and reviewed periodically.

### Strategic planning

Long-horizon and management-facing. This should stay sparse, stable, and explicit about uncertainty.

## What should be automated

Good candidates for automation:
- progress summaries
- next-step suggestions
- blocker surfacing
- state transitions
- evidence collection
- dashboard refresh
- roadmap diff generation

## What should not be automated blindly

Avoid fully automating:
- strategic priority setting
- product tradeoff decisions
- ownership changes
- scope cuts that affect people or commitments

These decisions can be assisted by the system, but they should remain visible and deliberate.

## Visibility principle

The best visibility is not more meetings or more slides. It is a living plan that is automatically reconciled with real execution, backed by artifacts, and understandable by both engineers and leadership.

## Practical policy

If a roadmap item has no corresponding evidence, it should be marked as speculative.

If evidence exists but the roadmap is stale, the roadmap should be updated.

If the system cannot derive a planning view from recent execution, the execution instrumentation is not good enough yet.
