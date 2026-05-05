# Tradeoffs and Tools

This document captures the main downsides of the project and the tools that can help both the build and the political story around it.

## Ten downsides

1. The project can drift into concept-heavy thinking and delay actual delivery.
2. The autonomy story can become unsafe if risk controls are too soft.
3. Rails can be harder for an agent to reason about than a more explicit stack.
4. The verifier loop can waste time and electricity if retry budgets are weak.
5. Security can become theater if the red-team role is not truly independent.
6. Tool sprawl can create a second project whose job is just to manage tools.
7. The experiment can overfit to a personal laptop instead of normal team workflows.
8. Visibility can outrun substance if public posts are not tied to real artifacts.
9. Local models may look good on simple work but still fail on subtle domain logic.
10. The project can become emotionally important enough that it is hard to judge honestly.

## Ten tools that materially help

1. Langfuse or Arize Phoenix for LLM traces, costs, and event timelines.
2. Tree-sitter for structured code understanding instead of naive grep.
3. Repomap or ctags for a compact repository symbol map.
4. MCP for standardized tool surfaces and reusable integrations.
5. VCR and WebMock for deterministic external API isolation.
6. Ephemeral Docker for a safe execution boundary.
7. SQLite for durable structured state and local memory.
8. Metabase for executive dashboards and simple leadership-facing reporting.
9. Circuit breakers for loop budgets, retry budgets, and failure containment.
10. A security/red-team role with its own prompts, artifacts, and checklists.

## Special review mode

One useful pattern is to run a separate unconstrained review model after implementation. This model should not be trusted with direct execution, but it can be valuable as a second-pass critic that inspects the final result with fewer behavioral brakes and a different failure mode.

The value of this mode is not obedience or safety. The value is fresh perspective, contradiction, and surfacing things the main model may have normalized.

## Tools that help with political capital

The tools above help the project itself, but a few of them also help with visibility and internal credibility:

- Langfuse or Phoenix, because graphs and traces make the experiment legible to leadership.
- Metabase, because dashboards are easier to share than raw logs.
- Tree-sitter and repomap, because they make the system look and feel like serious engineering rather than random prompting.
- MCP, because it signals standardization and platform thinking.
- Security tooling, because risk awareness is a strong management signal.

## Practical ordering

Start with observability, sandboxing, and repo understanding. Then add reuse, memory, and security. Only then optimize for speed and autonomy. If the system is not observable and safe, faster execution only scales confusion.
