# Instrumentation and Control Stack

## Purpose

Define the tooling stack that makes the experiment measurable, safe, and reusable.

This is the “staging-ready” layer: it does not try to sell a finished product, it proves a reproducible process and shows where time, tokens, cost, and risk go.

## 1. LLM observability

Use one observability layer as the system of record for model calls, tool calls, traces, sessions, and cost estimation.

### Recommended options

- **Langfuse**
- **Arize Phoenix**

### Why these tools make sense

Official docs confirm that both tools support:

- tracing of model and non-model calls
- cost and latency visibility
- prompt management
- evaluations
- dataset / experiment workflows
- self-hosting or open deployment patterns

Langfuse is especially aligned with:

- tracing
- prompt versioning
- experiments
- cost/latency visibility

Phoenix is especially aligned with:

- traces
- evaluations
- datasets and experiments
- prompt iteration
- span replay

### Expected value

These tools should let you answer questions like:

- what did the agent do
- how many tokens were spent
- how much cached context was reused
- which step was slow
- which tool caused loops
- which prompt version improved results

## 2. Code understanding

Use structural code understanding, not just grep.

### Recommended option

- **Tree-sitter**

### Why it matters

Tree-sitter is an incremental parser that can build syntax trees and update them efficiently as files change. That makes it a strong fit for Ruby/Rails repos where the agent should understand structure instead of doing blind text search.

### Expected value

- faster repo navigation
- better symbol discovery
- fewer noisy file reads
- less context waste
- better boundary detection for large files

## 3. Repo map / symbol map

Use a compact repository map in the style of tools like Aider’s repomap and ctags-based indexers.

### Purpose

The agent should see:

- classes
- methods
- file relationships
- dependency graph hints

without loading the entire repo into prompt context.

### Expected value

- lower token burn
- faster repo orientation
- better “what file should I open next?” decisions

## 4. Protocol layer

Use **MCP** for structured tool access.

### Why MCP makes sense

MCP is an open standard for connecting AI apps to external systems like files, databases, tools, and workflows. It gives you a reusable protocol instead of ad hoc shell glue.

### Expected value

- standardized tool contracts
- easier future integrations
- less brittle glue code
- better separation between model and tool runtime

## 5. Test isolation and HTTP control

Use network mocking and deterministic test behavior for anything that could otherwise hit real services.

### Recommended options

- **VCR**
- **WebMock**

### Why these tools make sense

VCR records HTTP interactions and replays them during tests.
WebMock stubs and verifies HTTP requests in Ruby.

### Expected value

- deterministic tests
- no accidental external API blasts
- safer agent loops
- cleaner failure reproduction

## 6. Sandboxing

Keep execution inside ephemeral containers.

### Baseline

- Docker sandbox per task or per chunk
- short-lived workspace
- mounted source tree with tight permissions
- writable scratch area only
- no raw secrets in the container

### Future option

- more isolated runtime like Firecracker only if it becomes necessary and is worth the operational cost

### Expected value

- no host damage
- easier rollback
- tighter blast radius
- simpler mental model

## 7. Memory and structured state

Use SQLite as the first serious structured memory layer.

### Store there

- task state
- checkpoints
- tool registry
- skill registry
- summaries
- cost snapshots
- security findings

### Add later if needed

- Postgres for heavier multi-user or reporting needs
- embeddings for retrieval
- vector search only as an accelerator, not as the only memory

### Expected value

- durable state without file sprawl
- resumability
- better auditability
- easier comparisons over time

## 8. Dashboarding

Use Metabase or another simple executive dashboard layer on top of structured state and observability outputs.

### Why

Because leadership and stakeholders understand:

- completed tasks
- throughput
- cost
- quality
- risk
- trend lines

not just trace logs.

## 9. Circuit breakers

Add hard stop conditions for loops.

### Examples

- same failure 3 times
- same tool call repeated too many times
- suspiciously growing context with no progress
- repeated security warning
- unbounded external calls

### Expected value

- less thrashing
- better human intervention points
- fewer infinite recovery loops

## 10. How the stack should be used

The stack should be ordered by function:

1. measure
2. understand
3. select context
4. execute
5. isolate
6. verify
7. replay
8. report
9. learn

The important thing is not to install every tool just because it exists. The important thing is to map each tool to a concrete failure mode or performance bottleneck.

## What this stack is for

This stack exists to make the experiment:

- visible
- reproducible
- safe
- cheap to compare
- worthy of being shown to management and engineers

