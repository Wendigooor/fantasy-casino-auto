# Agent Vision Plan

## Goal

Turn the mental experiment into an actionable operating model for local agents.

The target is not religious purity around local models. The target is a practical system that can work on a personal laptop, stay safe, and still produce visible, useful outcomes.

This is the vision layer of `Fantasy Casino as Agentic Stress Test`.

## Core idea

The agent system should behave like a disciplined engineering org:

- it knows what it is doing
- it reports status regularly
- it works in bounded chunks
- it asks for approval when risk rises
- it can show evidence of progress
- it can continue after interruptions

## Operational model

### When the laptop is on

- the orchestrator resumes from the latest checkpoint
- the planner picks the next bounded chunk
- the executor makes changes in the sandbox
- the verifier runs checks
- the reporter sends Telegram updates every 5 minutes
- screenshots are sent when useful

### When the laptop is off

- no fake activity is emitted
- the latest durable state is preserved
- the system simply waits for resume

## Standards of operation

### Standard 1: Visibility

Every agent must be able to explain:

- what task it is on
- what file group it is touching
- what the current blocker is
- what it will do next

### Standard 2: Safety

The system must always preserve:

- no direct deletion
- no secret leakage
- no uncontrolled host writes
- no risky change without approval

### Standard 3: Chunked delivery

Work should be delivered in meaningful pieces, not tiny scattered edits.

Each chunk should be:

- understandable
- testable
- reversible
- shippable

### Standard 4: Evidence

Every useful chunk should produce evidence:

- diff
- log
- test result
- screenshot if relevant
- short human-readable summary

## What the system should aim to become

The end state is a local engineering copilot that can:

- take a task from Telegram
- continue working only while the laptop is available
- keep the user informed
- build large pieces safely
- stay useful without pretending to be omnipotent

It should also avoid recreating the same tools, workflows, and prompts from scratch. Persistent tool and skill registries, plus structured memory and checkpoints, are part of the operating model.

## What the system should not become

- a silent black box
- a fake autonomous loop that reports progress without doing real work
- a file-destroying agent
- a model cult
- a local toy disconnected from product value

## Recommended posture

This should be treated as a production-quality experiment:

- serious enough to measure
- safe enough to trust in small increments
- flexible enough to use both local and non-local models

The primary application stack should stay Ruby on Rails for now, because reducing novelty is part of making the experiment actually work. Future language migration can be tested later, after the system proves itself on real tasks.

The model choice should be pragmatic:

- use local models for repetitive, private, high-frequency work
- use stronger external models for difficult reasoning, validation, or acceleration
- do not turn “local-first” into self-imposed austerity
