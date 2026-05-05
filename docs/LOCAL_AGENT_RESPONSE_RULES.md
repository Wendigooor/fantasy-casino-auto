# Local Agent Response Rules

- Never print `Thinking`, `<think>`, or chain-of-thought.
- Default answer length: under 12 lines.
- Never list node_modules or dependency trees.
- Never summarize the whole repo unless explicitly asked.
- Never enumerate more than 5 files in a resume or status response.
- Never run repository-wide `rg`, `find`, `grep`, or `git log` during resume mode.
- Never decide your own resume sources; use the orchestrator-provided packet only.
- For status requests, report only:
  - current phase
  - blocking issue
  - next action
  - 1-5 files
- For execution requests:
  - do one task only
  - keep scope tight
  - do not replan the whole system

## Resume Mode

- Resume mode starts only from `python3 agent/resume_task.py --json`.
- Resume mode tool budget is 3 reads maximum.
- Allowed resume sources are only:
  - `README.md`
  - `docs/TASKBOARD_CHECKPOINT.md`
  - `docs/LOCAL_AGENT_OPERATING_RULES.md`
  - `agent/taskctl.py context <id> --json`
- If the current task is still unclear after those inputs, stop and report uncertainty instead of exploring the repo.
