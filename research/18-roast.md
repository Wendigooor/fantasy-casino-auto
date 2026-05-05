# Roast: What Is Obviously Weak or Unclear Right Now

## What is strong

The overall concept is strong. There is a real operating model behind it, not just a “let’s make AI do things” vibe.

The strongest parts are:

- the local-first framing without religious purity
- the no-delete / quarantine discipline
- the Telegram heartbeat idea
- the explicit role separation
- the decision to use a casino-shaped stress test
- the choice to keep Rails as the primary stack
- the insistence on measurements and artifacts

## The obvious weak points

### 1. Security is still too hand-wavy

Saying “there will be a security role” is not enough. You need a real threat model, abuse tests, secret handling rules, and a red-team loop.

Right now, the plan knows security matters, but it does not yet fully specify how the security role behaves, what it can break, and how it wins when it disagrees with the other agents.

### 2. The system is still too optimistic about model behavior

The current documents assume that local or frontier models can be made disciplined with enough structure.

That is directionally true, but in practice:

- models hallucinate confidence
- tools fail in weird ways
- long sessions degrade
- repeated context changes break cache efficiency
- agents can over-execute when they should pause

The plan needs more explicit failure handling.

### 3. The backlog is still product-shaped, not milestone-shaped enough

There are good categories, but some items are still high-level.

What is missing:

- a sharper first-week goal
- a stricter definition of “done”
- explicit rollback criteria
- a smaller first lovable release

Without that, the project risks becoming an elegant document set that never hardens into a working loop.

### 4. The casino runtime is broader than the current implementation plan admits

The product plan covers important domains, but it still compresses several hard problems:

- wallet correctness
- provider callback idempotency
- bonus abuse
- compliance edge cases
- jurisdiction differences
- auditability

This is not a “detail gap”. These are the things that actually break real-money systems.

### 5. The visibility story is not fully operationalized

You want to become visible and respected. That is good.

But the current plan mostly says “produce artifacts” without yet specifying a publication cadence, audience, or reusability standard.

Without cadence, good intentions stay private.

### 6. The stack decision is sensible, but migration expectations need more discipline

Rails first is a good move.

But “we can later migrate pieces automatically” is still too vague.

You need to define:

- which pieces are migration candidates
- what success means for translation
- what classes of code should never be auto-translated first

### 7. The speed model is still only an estimate

The benchmark expectations file is useful, but many numbers are still hypotheses.

That is fine as long as they are treated as hypotheses.

The danger is that after a few demos they start feeling like truth.

### 8. The agent system may become too chatty

Heartbeat every 5 minutes is great if it is compact and useful.

It becomes bad if it turns into status theater.

The plan needs a hard rule that updates must be evidence-bearing, not decorative.

## Open questions that really matter

1. What exactly is the first “done” milestone for the agent loop?
2. What is the smallest useful casino runtime slice that still feels real?
3. Which security tests are mandatory before any meaningful autonomy?
4. Which model tasks must always escalate to a stronger model?
5. How much human review is required before a chunk is allowed to ship?
6. What is the publication rhythm that turns this into reputation, not just private progress?
7. How will you measure whether local-first is actually beating hybrid in your own environment?
8. What is the rollback story if the self-evolving security role finds something ugly?

## Blunt conclusion

The idea is strong enough to be worth doing.

But right now it still risks becoming an over-designed, under-bounded, very smart toy unless you keep forcing it into:

- small measurable chunks
- explicit security pressure-testing
- hard “done” definitions
- public artifacts with cadence
- model escalation when needed

That is the difference between a cool AI lab and a real growth platform.

