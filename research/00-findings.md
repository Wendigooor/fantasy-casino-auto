# Executive Summary

## Goal

The goal is to build a local, safety-first AI agent environment that can help evolve this project and its surrounding codebase without depending on external APIs for routine work. The system should be able to read the site content, propose changes, edit code in a controlled workspace, run tests, and deliver updates through Telegram.

This experiment is explicitly framed as **Fantasy Casino as Agentic Stress Test**: a casino-shaped domain used to pressure-test autonomous development, safety, observability, and your own engineering visibility.

## What the repo already gives us

The repository is not a loose blog post collection. It already looks like a complete operating model for a data department:

- `pages/data-architecture.html` defines the target stack and tooling philosophy.
- `pages/data-governance.html` defines ownership, access control, and lifecycle rules.
- `pages/dataops.html` defines CI/CD, monitoring, and on-call.
- `pages/mlops.html` defines model lifecycle and monitoring.
- `pages/finops.html` defines cost discipline.
- `pages/roadmap.html` defines a quarterly delivery cadence.

That means the AI-agent project should not be designed as a generic “autonomous coder”. It should be designed as an operational layer on top of a mature reference architecture.

## Main conclusions

1. The strongest local stack for a MacBook Pro with 48 GB unified memory is a compact, disciplined one: one primary coding model, one smaller drafting model if needed, tight context budgets, and aggressive reuse of cached prompts.
2. Apple Silicon makes MLX a natural first choice for local experimentation because it is built for Apple silicon and uses a unified-memory model that fits this hardware class well.
3. The current Qwen3 family is more relevant than the older “Qwen 27B dense” idea. The official Qwen3 repo documents dense sizes such as 32B and larger MoE variants, plus local-running guidance.
4. `midudev/autoskills` is real and useful for bootstrapping skills automatically from the repository stack, but it should be treated as a controlled installer, not an unconditional self-modifying system.
5. The biggest risks are not “model quality” alone. The real risks are sandbox escape, secret leakage, uncontrolled file deletion, task loops, and unbounded cost from repeated retries.
6. Several ideas from the original notes need verification before they become design dependencies, especially “Obscura”, “Hermes agents”, and “dflash”. They may be useful concepts, but they should not be treated as core architecture until confirmed.

## Recommended stance

The system should begin as a human-supervised local agent platform with strong guardrails. Only after it proves stable should it gain partial autonomy.

The experiment should remain local-first but not local-only. External frontier models remain available as escalation tools when they improve quality, speed, or confidence.

The right default is:

- local inference first
- external APIs only for hard edge cases
- no destructive filesystem actions
- explicit approval for risky operations
- telemetry for every meaningful action
- skills generated only when a repeated pattern is proven

## Key metric set

The experiment should be measured by operational metrics, not just “did the model answer well”.

- task completion rate
- patch acceptance rate
- test pass rate
- time-to-first-token
- tokens per second
- cache hit ratio
- cost per completed task
- rollback rate
- human intervention rate
- secret leakage incidents
