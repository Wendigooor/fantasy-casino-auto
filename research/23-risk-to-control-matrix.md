# Risk to Control Matrix

This document maps the most important project risks to concrete controls, instrumentation, and operating rules. The purpose is not to eliminate risk entirely, but to make risk visible, bounded, and measurable.

## 1. Aggressive autonomy

Risk: The agent keeps changing code without a pause, builds confidence from incomplete evidence, or enters a destructive loop.

Controls: Use task budgets, loop budgets, and change scopes. Add a circuit breaker for repeated failure classes. Require a quarantine branch for suspicious or broad changes. Keep a clear replayable trail of actions, diffs, and test results.

Evidence to collect: Number of loops per task, repeated failure signatures, time-to-first-useful-patch, and rollback frequency.

## 2. False security confidence

Risk: The security role becomes a rubber stamp because it runs on the same model family and sees the same blind spots.

Controls: Make security a separate role with separate prompts, outputs, and checklists. Require threat modeling, abuse-case generation, secret scanning, dependency review, and diff-based red-team notes. Store security artifacts independently from code-agent artifacts.

Evidence to collect: Number of high-risk findings, uncovered assumptions, negative test coverage, and unresolved threat items.

## 3. Rails hidden complexity

Risk: The agent gets lost in metaprogramming, callbacks, dynamic routing, and implicit behavior.

Controls: Prefer explicit service objects, clear directory conventions, and architectural maps. Maintain a repo symbol map, route map, and domain glossary. Minimize additional magic in the experiment codebase.

Evidence to collect: Time spent locating symbols, number of files needed to explain a feature, and frequency of context misses.

## 4. Verifier token burn

Risk: Test-and-fix loops waste time and money on the same failing path.

Controls: Set retry budgets, max-loop limits, and time budgets. Use targeted tests instead of full-suite runs whenever possible. Stop and summarize after repeated identical failures. Route ambiguous failures to quarantine instead of endless repair.

Evidence to collect: Number of repeated test loops, average verifier time per fix, and cost per successful task.

## 5. Tool sprawl

Risk: The project becomes a pile of one-off tools that are hard to reuse and hard to explain.

Controls: Keep a tool registry, a skill registry, a memory layer, and an artifact store. Only add a tool if it solves a repeated problem or improves observability, isolation, or reuse. Prefer standardized interfaces such as MCP where possible.

Evidence to collect: Tool usage frequency, repeated task patterns, and the percentage of work handled by reusable tools.

## 6. Memory fragmentation

Risk: Important decisions and patterns get scattered across chat, files, prompts, and ad hoc notes.

Controls: Define a source-of-truth hierarchy. Use SQLite or another structured store for durable state. Keep summaries, checkpoints, and decision logs in explicit artifacts. Treat Telegram and chat as operational views, not the only memory.

Evidence to collect: How often the same decision must be rediscovered, and how long it takes to reconstruct prior state.

## 7. Sandbox escape

Risk: The agent performs unsafe file, shell, or network operations on the host.

Controls: Run execution inside an ephemeral container. Restrict host mounts. Use a no-delete policy that prefers move-to-quarantine over deletion. Log all writes and shell calls. Keep secrets outside the sandbox.

Evidence to collect: Attempts to access restricted paths, unsafe command attempts, and any host-side action requests.

## 8. Demo theater

Risk: Heartbeats, dashboards, and status messages create the illusion of progress without real delivery.

Controls: Tie every update to a concrete artifact: patch, test, screenshot, diagram, or decision note. Make the heartbeat evidence-based and short. Show progress in diffs and verified outcomes, not only in narrative.

Evidence to collect: Ratio of artifacts to status messages, and the number of status updates that lack new evidence.

## 9. Overfitting to the lab

Risk: The experiment works only in the local setup and does not generalize to real delivery.

Controls: Keep the repo close to a normal Rails workflow. Use ordinary developer patterns where possible. Measure what is reusable outside the experiment. Avoid exotic architecture unless it pays for itself.

Evidence to collect: How many components are reusable in a normal project, and how many are special-purpose lab glue.

## 10. Visibility without substance

Risk: The project becomes a personal brand exercise with weak engineering output.

Controls: Pair every public narrative with a real technical artifact. Publish clear benchmarks, failure analyses, and implementation notes. Use the experiment to generate useful ideas, not only content.

Evidence to collect: Number of artifacts that people can reuse, cite, or challenge.

## Operating principle

The system should not aim for zero risk. It should aim for legible risk, bounded autonomy, and repeatable learning. If a failure happens, the goal is to understand it quickly, contain it safely, and convert it into a documented improvement.
