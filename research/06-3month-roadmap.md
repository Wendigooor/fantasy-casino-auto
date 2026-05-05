# 3-Month Roadmap

## Framing

This roadmap is built for `Fantasy Casino as Agentic Stress Test`, not for a generic AI toy project. Every month should produce both technical progress and public-facing evidence of leadership.

## Month 1: Make the loop work

### Goals

- get one local model running reliably
- create one agent loop with planner, executor, and verifier
- connect Telegram notifications
- make file operations safe
- produce traceable logs

### Deliverables

- model runtime
- task intake
- sandboxed workspace
- diff preview flow
- quarantine folder for moved files
- test runner integration
- basic observability

### Exit criteria

- the system can complete a small repo task without manual micromanagement
- no files are deleted
- every action is logged
- progress can be followed in Telegram

## Month 2: Make it useful

### Goals

- let the agent work in larger chunks
- add skills that match the repo stack
- improve recovery from failures
- improve context reuse and prompt discipline
- start collecting metrics on effort and cost
- produce at least one public Slack insight from the experiment

### Deliverables

- skill bootstrapper
- skill allowlist
- retry strategy
- task queue
- session replay
- cost and token metrics
- stronger test feedback loop

### Exit criteria

- the system can handle medium-sized tasks
- repeated work gets turned into reusable patterns
- the task loop becomes visibly more efficient

## Month 3: Make it stable

### Goals

- harden the boundaries
- reduce autonomy risks
- improve auditability
- prepare a durable working model for continued experimentation
- turn the work into a repeatable narrative you can share without sounding speculative

### Deliverables

- explicit approval gates
- task classification by risk
- better rollback path
- longer-running job support
- summarized execution reports
- a first version of local engineering playbooks

### Exit criteria

- the system is usable as a daily assistant for a single developer
- it supports large-batch work without becoming chaotic
- it has a clear safety story

## Monthly focus areas

### Month 1 focus

- safety
- locality
- visibility

### Month 2 focus

- usefulness
- skills
- feedback

### Month 3 focus

- reliability
- control
- repeatability

## Deliverable hierarchy

The roadmap should follow this order:

1. control plane
2. execution plane
3. test plane
4. observability plane
5. skills plane
6. autonomy plane

## Why this sequence works

It matches the actual risk profile:

- you can recover from a bad suggestion
- you can recover from a bad patch
- you cannot easily recover from a broken money system or leaked secret

So the system should become capable only as it becomes trustworthy.
