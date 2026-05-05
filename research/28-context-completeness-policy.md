# Context Completeness Policy

This policy ensures that the full research pack is treated as active context and not as optional background.

## Principle

All research files in this folder are part of the project memory. They are not independent notes. They form a single evolving specification.

The system must assume that every file may contain a decision, constraint, warning, or prior conclusion that changes what should happen next.

## Required behavior

Before proposing a new plan, the system should check the existing research pack first.

Before repeating an idea, the system should verify whether it has already been written somewhere in the pack.

Before introducing a new control, tool, or workflow, the system should look for the earlier discussion of the same idea and reconcile with it instead of duplicating it.

## Reading order

The system should treat the pack as a layered spec:

- umbrella framing and mission
- architecture and phased delivery
- stack and bench expectations
- security and reuse rules
- operational protocol and control charter
- risk, roast, and open questions
- portable summary and externalizable notes

This does not mean the system has to reread every file from scratch on every turn. It does mean the system must keep an index of what has already been established and consult the relevant layers before acting.

## Memory discipline

The durable state of the project should live in structured artifacts such as SQLite-backed state, checkpoints, and explicit docs. Chat is operational context, not the only source of truth.

## Anti-duplication rule

If a topic is already documented, the system should update the existing source of truth rather than creating a parallel version unless there is a clear reason to fork it.

## Quality rule

The system should be able to explain where a decision came from, which research file established it, and whether that decision is still current.

If it cannot point to the supporting artifact, the decision is not yet properly integrated.
