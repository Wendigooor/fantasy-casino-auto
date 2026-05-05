# Fantasy Casino as Agentic Stress Test

## One-line summary

This project is a realistic casino-shaped engineering stress test for proving that a personal laptop can support safe, observable, local-first autonomous development, while also becoming a platform for your own visibility, leadership, and public engineering reputation.

## Why this exists

The casino domain is useful because it is not a toy. It naturally forces the system to deal with money, auditability, compliance, risk, telemetry, product complexity, and the consequences of wrong decisions. That makes it an excellent hard-mode environment for testing agentic workflows.

At the same time, the project is not primarily about “building a casino.” It is about building an operating model:

- local AI as the default backbone
- safe autonomous execution in a sandbox
- Telegram as an operator-facing control plane
- detailed logging, screenshots, and artifacts
- reusable tools and skills
- measurable performance and cost
- a narrative you can share publicly as proof of engineering maturity

## Current strategic framing

The agreed umbrella title is:

**Fantasy Casino as Agentic Stress Test**

That means the project should always be understood as three things at once:

1. A technical experiment on autonomy, local compute, and safety.
2. A product/runtime blueprint for a real-money casino-like system.
3. A visibility engine for your growth as an engineering manager.

## Core stance

The system should be:

- local-first, not local-only
- safe before autonomous
- evidence-based, not vibe-based
- chunked, not monolithic
- reusable, not reinvented on every task
- measurable, not anecdotal

You explicitly do **not** want an “as a service babysitter” setup. You want the system to do large chunks of work with minimal manual friction, while still surfacing what was risky, what was unclear, and what needed attention.

## Current stack decision

The experiment should use **Ruby on Rails** as the primary application stack.

Reasoning:

- it matches your current mental model and reduces novelty
- it avoids turning the experiment into a language-learning exercise
- it makes the system easier to test and reason about
- it can later be translated in pieces if needed

The migration philosophy is:

- build something working, tested, observable, safe, and explainable first
- later, translate specific pieces if there is a clear reason
- do not chase language migration as the main point of the experiment

## Expected model/runtime behavior

Your local target is a MacBook Pro M5 with 48 GB unified memory. The main local model direction is:

- `mlx-community/Qwen3.5-27B-4bit`
- `z-lab/Qwen3.5-27B-DFlash`
- `DDTree-MLX`
- MLX serving on Apple Silicon

The realistic expectation is not “Claude-level raw magic.” The realistic expectation is a useful local agent loop that can do meaningful work cheaply and privately.

### Rough speed expectations

These are benchmark-style expectations, not promises:

- clean generation on short tasks: about `15–25 tok/s`
- with speculative decoding / drafter acceleration: about `20–35 tok/s`
- on long-context, tool-heavy sessions: sometimes `8–15 tok/s`

What matters more than raw tok/s:

- how much context is wasted
- how often the agent repeats itself
- how many useless tool calls happen
- whether the task loop stays bounded and explainable

## Tooling expectations

### RTK

`RTK` is useful because it filters and compresses command output before it reaches model context.

That does **not** make the model itself faster, but it can significantly reduce:

- token burn
- prompt clutter
- repeated terminal noise
- wasted context expansion

This is likely to matter a lot in agent mode because the system will repeatedly run:

- `git status`
- `git diff`
- `go test` or `bundle exec rspec`
- `ls`
- `grep`
- log inspection

### MCP caching / context caching

Caching context for MCP or other tool layers should help a lot, especially for repeated repo inspection and repeated work patterns.

It should reduce:

- repeated prompt reconstruction
- repeated file discovery
- repeated long-form context injection

It will not magically increase raw model tok/s, but it should improve end-to-end usefulness.

### Go vs Ruby

You decided to stay with Ruby on Rails as the primary stack.

That is a good decision because:

- it keeps the system aligned with your current environment
- it reduces accidental “learning project” drift
- it lets the model operate in a familiar codebase
- it makes it easier to later compare automatic translation results

Go can still be used later for infrastructure pieces, but it is not the starting point.

## Success criteria for the experiment

The first minimally successful result is not “the agent wrote some code.”

The first success is:

- a working pipeline where problems are solved independently
- features are built independently
- each meaningful step is documented in detail
- each step produces artifacts
- each step records timing and cost
- each step can be compared against doing it manually or via frontier models

You want the system to answer:

- what happened
- what broke
- how it was fixed
- what evidence exists
- how fast it was
- how expensive it would have been otherwise

That is the right success definition for a serious experiment.

## Security posture

Security is a separate, explicit layer.

You do **not** want to personally review every code line, and you explicitly do not consider yourself a security specialist. Because of that, the system needs a dedicated role that behaves like:

- security reviewer
- red team
- pentester
- invariant checker
- unknown-unknown hunter

### Security self-evolving role

This role should:

- inspect code diffs
- inspect configs and workflows
- look for permission and boundary mistakes
- run abuse tests
- try prompt injection
- look for sandbox escape routes
- try to provoke secret leakage
- identify suspicious repeated patterns

The role should output:

- what is likely dangerous
- what is definitely dangerous
- what is unknown and must be tested
- what mitigation is needed
- what residual risk remains

Important nuance:

- security should not just block everything
- it should actively pressure-test the system and report problems
- it should be self-evolving, not static

## Autonomy stance

Your stated autonomy stance is aggressive:

- no automatic hard human gate as a permanent design principle
- no fixed “these categories always require approval” mindset
- no local-only religious restriction
- no perpetual babysitting mode

Instead, the system should:

- operate with high autonomy
- learn what was risky
- report likely-dangerous actions
- preserve a rollback story
- keep the human as a participant in the experiment, not a permanent veto point

That is a bold stance, and it is exactly why the safety and observability layers matter so much.

## Source of truth

Your current stance is:

- git
- database
- Telegram
- research docs
- artifacts

All together form the source of truth, with clear precedence.

Practical precedence recommendation:

1. Git for source code and diffs
2. SQLite for structured local state and checkpoints
3. Telegram for live operational communication
4. research docs for durable strategy and decisions
5. artifacts for screenshots, logs, benchmarks, and evidence

## Memory and reuse

This is one of the most important architectural points.

You do not want the system to recreate tools on every small change.
You want it to learn once and reuse many times.

### Reuse layer components

1. **Tool Registry**
   - persistent catalog of available tools
   - each tool has a name, purpose, inputs, outputs, safety class, version, and usage rules

2. **Skill Registry**
   - persistent catalog of reusable workflows
   - examples: repo indexing, diff summarization, test triage, heartbeat reporting, security review

3. **Memory Layer**
   - `SQLite` for fast local state and experiment history
   - optional `Postgres` later if you need collaboration or heavier reporting
   - embeddings for retrieval, not as the only source of truth
   - prompt cache for repeated context, but not as memory itself

4. **Artifact Store**
   - plans
   - diffs
   - screenshots
   - logs
   - benchmark results
   - postmortems

5. **Context Selector**
   - chooses only the relevant docs, tools, skills, and artifacts for a task
   - does not rehydrate the whole universe every time

6. **Checkpointing**
   - every meaningful chunk creates a durable checkpoint
   - stores task id, state, blockers, changed files, current tools, and next step

### Why this matters

This is how you avoid the “new tool for every tiny thing” failure mode.

Instead of rebuilding the same screwdriver:
- register it once
- reuse it many times
- summarize the successful pattern into a skill
- keep the state structured and resumable

## Operational model

The system should behave like a disciplined engineering org:

- planner
- executor
- verifier
- reviewer
- reporter
- security role

### Working rhythm

When the laptop is on:

- the orchestrator resumes from the last checkpoint
- the planner picks the next bounded chunk
- the executor makes changes in the sandbox
- the verifier runs checks
- the reporter sends Telegram updates every 5 minutes
- screenshots are sent when useful

When the laptop is off:

- no fake activity is emitted
- the latest durable state is preserved
- the system waits for resume

### Telegram heartbeat

The heartbeat should be short, consistent, and evidence-bearing.

Examples:

- `Task 51.2 | role: executor | Doing: adding admin audit logs | Status: patch prepared, running checks | Risk: low | Next: verify output`
- `Task 51.2 | role: planner | Blocker: logging split across handler and service layers | Need: choose canonical write point`

The heartbeat should avoid being status theater.
It should say what is real.

## Project backlog shape

The repository already contains a very strong operating-model blueprint for the data department.

For the casino runtime, the main product-side concerns are:

- identity and access
- wallet and cashier
- game session and round flow
- bonus and promo engine
- risk and responsible gaming
- compliance and KYC
- analytics and telemetry

The technical plan is to build a modular monolith for the transactional core and surround it with:

- provider adapters
- event bus
- ClickHouse analytics
- observability
- agent-assisted engineering support

## Concrete technical risks

The most obvious risk areas are:

### 1. Security is still too hand-wavy

Even with a dedicated security role, the exact threat model, abuse tests, and red-team flow must be made concrete.

### 2. The model may be over-trusted

Local and frontier models can still:

- hallucinate confidence
- repeat the same failure
- misjudge risk
- overshoot on execution

### 3. The casino runtime is broader than it looks

Money movement, provider idempotency, bonus abuse, compliance, and auditability are not minor details. They are the hard core of the product.

### 4. Visibility is not yet fully operationalized

You want this to become a public growth platform, so cadence matters:

- Slack insights
- diagrams
- screenshots
- benchmarks
- postmortems
- short lessons learned

### 5. Language migration is still vague

Rails first is correct, but the future “automatic migration” story needs clearer rules:

- what is migratable
- what is not
- what success looks like
- what should never be translated first

## Open questions to keep alive

1. What counts as the first real success?
2. What is the exact secure boundary, if any?
3. Which actions should always trigger review, if any?
4. Where should long-term memory live and how should it be structured?
5. How do we prevent the system from recreating tools on every task?
6. What is the right autonomy model for Rails, infra, security, and money logic?
7. How do we measure that this is saving time and producing visibility?
8. What is the source of truth if everything matters?
9. What does rollback look like in practice?
10. How do we keep the heartbeat honest and useful?

## Your current answers, condensed

You have already made several important decisions:

- first result = autonomous pipeline with detailed step logging and cost comparison
- security = agent should probe and report dangerous areas, not only block
- approval = ideally none as a permanent rule
- memory = SQLite is attractive, but the system should choose what works
- tool creation = reuse patterns from the network and from prior work
- autonomy = full, for now
- escalation to frontier models = only when you personally decide to review and are unhappy with local output
- truth source = everything together
- rollback = examples and options are needed

That is a very aggressive autonomy profile, and it is exactly why the repository now also includes:

- the security self-evolving role
- the reuse layer
- the critical open questions file
- the benchmark expectations file
- the agent manual and the control-plane docs

## What the system is really for

This is not just a coding experiment.

It is a growth platform with three goals:

1. Prove that a local-first agentic engineering setup can actually work.
2. Prove that you can use a realistic hard domain as a stress test and still keep control.
3. Turn the work into a visible, repeatable narrative that makes you look like someone who understands the future of engineering operations.

## Final blunt summary

The project is strong because it is specific, realistic, and ambitious.

It becomes dangerous if it turns into:

- too much theory
- too little measurement
- too little security rigor
- too much trust in model behavior
- too much reinvention of tools
- too little public artifact generation

The next step is not to fantasize harder.
The next step is to force the system into:

- reusable tools
- reusable skills
- structured memory
- checkpoints
- security pressure tests
- detailed stepwise artifacts
- honest benchmarks
- visible progress

That is how this becomes a real platform for your growth, not just a cool idea.

