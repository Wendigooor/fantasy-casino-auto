# Fantasy Casino Control Charter

This charter defines the experiment as a managed engineering system, not as a vague AI demo. Its purpose is to keep the project legible, safe, measurable, and reusable while still allowing high autonomy.

## Mission

Fantasy Casino is a casino-shaped Rails stress test for autonomous software development on a personal laptop. The goal is to prove that a local agent stack can plan, implement, verify, document, and explain meaningful engineering work with enough safety and observability to be worth scaling.

The project also serves as a visibility engine. It should create artifacts that can be shown to engineers, managers, and leadership as evidence of real process maturity, not just model hype.

## What success looks like

Success means the system can repeatedly complete useful chunks of work with minimal hand-holding, while producing detailed evidence about what happened, what failed, what was learned, and how much time or cost was saved compared with manual or frontier-model execution.

The output must include code, tests, traces, dashboards, status reports, and postmortems. If the system cannot explain itself, it is not yet good enough.

## Core definition

Fantasy Casino is not a real-money gambling product. It is a transactional, audit-heavy, admin-heavy, risk-aware engineering sandbox that resembles a casino domain enough to stress the agent system, but not enough to enter real operational or regulatory scope.

The first useful surface should include users, balances, transactions, rounds, bets, settlements, admin tools, audit logs, and reporting. That is enough complexity to test autonomy without building a real gambling business.

## Autonomy stance

The project is local-first and autonomy-first. The agent should do real work instead of waiting for a human to babysit every step. At the same time, autonomy must remain bounded by clear risk controls, budgets, sandboxing, and replayable artifacts.

The system does not need hard human gates on every change. It does need hard controls on dangerous classes of work, loop budgets, and dangerous execution contexts.

The orchestrator is a reasoning layer, not a coding layer. It should plan, coordinate, choose the next step, maintain state, and decide when to ask for help. Coding should happen in separate execution roles so thinking and patching stay distinct.

## Risk controls

The main risks are aggressive autonomy, false security confidence, Rails hidden complexity, verifier token burn, tool sprawl, memory fragmentation, sandbox escape, demo theater, overfitting to the lab, and visibility without substance.

These are handled by task budgets, loop budgets, quarantine branches, diff-based security review, repo maps, explicit memory layers, ephemeral execution, circuit breakers, and evidence-based reporting.

The security role is not a rubber stamp. It must produce threat models, abuse cases, diff findings, and containment recommendations. Its job is to surface risk, not to pretend risk does not exist.

## Tooling principle

The project should not recreate tools on every task. Reuse is a first-class design goal.

The core reusable layers are:
- a tool registry
- a skill registry
- a structured memory layer
- an artifact store
- a context selector
- checkpointing and rollback

The system should prefer standard interfaces such as MCP where possible. Repeated patterns should become reusable skills. Repeated task shapes should become templates. Repeated context should become structured state rather than prompt noise.

## Instrumentation principle

The stack should begin with observability, not optimization.

The recommended control stack is:
- Langfuse or Arize Phoenix for traces and cost-like accounting
- Tree-sitter for structural code understanding
- repomap or ctags for compact repository maps
- MCP for standardized tool surfaces
- VCR and WebMock for deterministic external API isolation
- ephemeral Docker for safe execution
- SQLite for durable structured state
- Metabase for dashboards
- circuit breakers for loops and retries

Some tools are optional and can be added later if the experiment proves that they pay for themselves. The order matters: observe first, then understand, then execute, then optimize.

In addition to the main working model, the experiment may run a separate unconstrained review model as a fresh-eyes reviewer. Its role is not to execute changes, but to inspect the final outcome, challenge assumptions, and surface blind spots that the main safety-bounded stack may have missed.

## Operating rule

Every meaningful action should leave an artifact.

Every artifact should answer at least one of these questions:
- what happened
- why it happened
- what changed
- what failed
- how it was tested
- how much it cost
- what should happen next

If there is no evidence, there is no learning.

Between sessions, the orchestrator may ask the user short non-blocking questions that reduce uncertainty or improve quality. The user may answer or ignore them. The system must keep moving with the best available assumptions when no answer arrives.

## Visibility principle

This experiment should produce public value as well as internal value. The best visibility comes from concrete proof: dashboards, diagrams, postmortems, benchmarks, and lessons that other engineers can actually use.

The goal is not to sound impressive. The goal is to become the person who can show a serious, measured, and repeatable AI engineering operating model.

## Operating protocol

The project should be controlled through explicit state transitions rather than informal chat memory. The primary states are `idle`, `planned`, `running`, `paused`, `blocked`, `needs_review`, `quarantine`, and `done`.

The operator should be able to move the system through `start`, `pause`, `resume`, `review`, `replan`, and `quarantine` actions. Pause should freeze future work after a safe boundary and preserve a checkpoint. Resume should continue from the checkpoint rather than replaying the whole conversation. Review should stop execution and run a bounded verifier plus a fresh-eyes pass. Replan should rebuild the plan from the current state without discarding useful evidence.

The project should also treat the full `research/` pack as one living source of truth. If a decision or constraint is already recorded there, the system should reuse it, cite it, and update it in place when it changes.

The long-form project evolution report should be maintained continuously as work happens. Every meaningful chunk of execution should update the report with evidence, decisions, failures, or learnings so the final narrative can be assembled from the living record.

## Bottom line

Fantasy Casino is a controlled attempt to answer one hard question: can a local, observable, reusable, and security-aware agent system produce meaningful Rails software with enough reliability to become a real operating model?

Everything in the experiment should support that question. If a tool, workflow, or idea does not improve safety, clarity, reuse, speed, or visibility, it is secondary.
