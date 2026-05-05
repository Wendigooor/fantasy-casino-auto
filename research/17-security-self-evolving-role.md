# Security Self-Evolving Role

## Purpose

Create a dedicated security role inside the agent system whose only job is to challenge the rest of the system.

This role exists because you do not want to personally reason about every security detail, and because the rest of the agent stack must assume that mistakes will happen.

## Core thesis

Security must not be a passive checklist. It should be an active, self-improving review loop that continuously tries to break the system, even when the rest of the agents think things are fine.

## Responsibilities

### 1. Threat modeling

The security role should identify:

- trust boundaries
- sensitive assets
- likely attacker paths
- failure modes
- privilege escalation surfaces
- data exfiltration routes

### 2. Static review

It should inspect:

- code diffs
- configuration changes
- workflow definitions
- container settings
- permission models
- secret handling paths

### 3. Dynamic testing

It should also run tests that simulate abuse:

- malformed inputs
- path traversal
- command injection
- prompt injection
- permission bypass attempts
- secret leakage attempts
- tool misuse

### 4. Red-team behavior

The security role should actively try to:

- delete files
- exfiltrate secrets
- escape the sandbox
- misuse tools
- confuse approvals
- cause the agent to over-trust unsafe instructions

The point is not to be destructive in production. The point is to pressure-test the guards in a controlled environment.

### 5. Unknown-unknown hunting

The role should not only check known risks. It should also look for patterns that suggest hidden risks:

- unusual repeated prompts
- suspiciously broad file access
- inconsistent logging
- silent failures
- unverified assumptions
- unexpectedly permissive defaults

## Operating principle

The security role should behave like a skeptical senior security engineer, a pentester, and a compliance reviewer combined.

It should be able to say:

- this looks safe enough
- this is unsafe
- this is unknown and must be tested
- this is safe only under a specific boundary

## Required outputs

Every security review should produce:

- threat summary
- attack surface list
- priority risks
- mitigation actions
- tests to run
- residual risk statement

## Placement in the agent system

The security role should sit between execution and finalization.

Suggested flow:

1. planner proposes work
2. executor patches in sandbox
3. verifier checks correctness
4. security role red-teams the change
5. human approves or rejects if needed
6. finalization or rollback

## What it should not be

- not a decoration
- not a once-a-month audit
- not a manual side note
- not a replacement for human judgment

## How to use it in this experiment

The security role should be mandatory for:

- auth code
- wallet code
- provider integrations
- secret handling
- deployment config
- sandbox boundaries
- agent orchestration logic

For lower-risk content changes, it can run in lightweight mode.

