# Open Questions and Your Answers

## 1. What counts as a minimally successful first result?

Your answer: the first successful result is a pipeline where problems are solved independently, features are built independently, and every meaningful step is documented in depth.

That means the experiment should produce:

- a working autonomous pipeline
- detailed step-by-step notes
- encountered problems and how they were resolved
- artifacts produced along the way
- speed measurements
- cost comparison versus doing it yourself or using frontier models

## 2. What is the exact security boundary?

Your answer: the agents should be allowed to operate broadly, but the orchestrator must still identify what was probably dangerous and report it to you.

That means the security boundary is not “hard frozen by the human”. Instead, the system should discover and report risky areas while you remain part of the experiment.

## 3. Which changes always require human approval?

Your answer: ideally none.

That is a strong autonomy stance. The experiment should therefore treat human approval as a temporary fallback, not a permanent design goal.

## 4. Where does long-term memory live?

Your answer: it is up to the system, but SQLite looks attractive because files alone feel messy, while the system still needs speed and autonomy.

## 5. How do tools get created and reused?

Your answer: the system should create tools and skills from what it learns, reuse patterns from the network, and look at competitors and leaders for inspiration.

That means tool reuse should be a first-class capability, not an afterthought.

## 6. What autonomy is allowed for Rails, infrastructure, security, and money logic?

Your answer: for now, full autonomy.

You want the system to push toward leadership in autonomy rather than act as a cautious babysitter.

## 7. What is the escalation policy to frontier models?

Your answer: none inside the system. Local models are the operating default. Frontier models are used only when you personally choose to review work and are unhappy with the result.

## 8. How do we measure real value versus noise?

Your answer: propose options and let you choose.

## 9. What is the source of truth for project state?

Your answer: everything together.

That means git, database, Telegram, and research docs all matter.

## 10. What does rollback look like?

Your answer: you want examples and options, then you will choose.

## Commentary

Your answers define a very ambitious autonomy profile:

- high trust in agents
- low manual gating
- local-first execution
- strong willingness to let the system figure things out

That is a powerful experimental stance, but it makes the safety and observability layers even more important.

