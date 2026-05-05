# Ideal Agent Workday

This is the target operating rhythm for `Fantasy Casino as Agentic Stress Test`.

## Morning start

The laptop wakes up and the orchestrator resumes from the last checkpoint.

The system:

- reads the last task state
- checks the queue
- loads the relevant repo context
- sends an initial Telegram update

## Work block 1

The planner selects a meaningful chunk.

Examples:

- add admin logs
- patch a broken link group
- add a missing test
- align a document with the data model

The executor applies the change in the sandbox.

## Work block 2

The verifier runs checks.

If there is a failure:

- the agent reports it
- the diff is preserved
- the next action is explicit

If there is no failure:

- the change is summarized
- screenshots are attached if useful
- the result is ready for review

## Midday state

By midday, the Telegram thread should show:

- what task was attempted
- what is complete
- what is blocked
- what evidence exists

## Afternoon refinement

The agent may continue with a second chunk if the first one was successful.

The second chunk should ideally be related but not identical:

- add tests after adding functionality
- add logging after wiring a flow
- add documentation after stabilizing a change

## Shutdown

When the laptop closes or the work session ends:

- checkpoint current state
- store logs
- preserve diffs
- preserve screenshots
- preserve next-step intent

## What a good day looks like

A good day is not one where the agent is busy all the time.

A good day is one where:

- it finishes meaningful chunks
- it stays explainable
- it stays safe
- it does not waste your attention

## Visibility layer

A good day should also create at least one artifact that can be reused publicly:

- a diagram
- a benchmark
- a Slack insight
- a screenshot
- a short lesson learned
