# Stack and Benchmark Expectations

## Stack decision

Use **Ruby on Rails** as the primary application stack for the experiment.

This is the right choice because it matches the current working context, reduces unnecessary novelty, and lets the agent focus on building real value instead of learning a second stack at the same time.

## Why Rails

- it matches your current mental model
- it reduces friction for you as the human owner
- it keeps the experiment practical instead of performative
- it produces a real application that can later be migrated in pieces
- it gives the agent a familiar, testable structure to operate in

## Migration philosophy

The first goal is not to prove that the system can rewrite everything in another language.

The first goal is to produce something:

- working
- tested
- observable
- safe
- easy to explain

After that, selected pieces may be translated automatically later if it is useful.

## What to measure

The experiment should record expectations before the build and compare them to reality later.

### Model/runtime

- time to first token
- tokens per second
- output quality on code tasks
- output quality on planning tasks
- context retention over long sessions

### Agent throughput

- time to finish a small chunk
- time to finish a medium chunk
- time to recover from failure
- number of tool calls per completed task

### Tool effectiveness

- RTK output filtering savings
- context cache hit rate
- MCP cache usefulness
- screenshot usefulness
- Telegram heartbeat usefulness

### Safety and control

- direct deletion attempts
- quarantine usage
- approval gates triggered
- rollback frequency
- secret leakage incidents

### Product value

- number of useful patches
- number of accepted changes
- number of public insights produced
- number of reusable docs created

## Working hypotheses

1. Rails will keep the product side grounded and easy to test.
2. Local models will be sufficient for a large share of routine code and docs work.
3. RTK-style output filtering will reduce noise significantly.
4. Context caching will matter more than raw speed in many tasks.
5. Go may still become useful later for infrastructure pieces, but it is not the first move.
6. A test-backed Rails codebase will be a good target for eventual language migration experiments.

## Baseline expectation

The baseline is not “how fast can the model talk”.
The baseline is:

- can the system move real work forward safely
- can it stay understandable
- can it prove its own usefulness
- can it become a public signal of engineering maturity

