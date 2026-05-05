"""
Fantasy Casino — Planner Role.

The planner reads context and proposes a concrete plan for a given task.

Responsibilities:
- Break large tasks into safe chunks
- Identify dependencies
- Estimate risk
- Define verification steps

The planner is a reasoning role, not a coding role.

Usage:
    from agent.orchestrator.planner import draft_plan, get_plan, list_plans

    plan = draft_plan(
        task_title="Implement user authentication",
        task_description="Add JWT-based auth with session management",
        risk_class="high",
    )
"""

import os
import json
from datetime import datetime, timezone

PLANS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "plans")
os.makedirs(PLANS_DIR, exist_ok=True)


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _model_endpoint() -> str:
    return os.environ.get("MODEL_ENDPOINT", "http://127.0.0.1:8080/v1")


def _call_model(system_prompt: str, user_prompt: str, endpoint: str = None) -> tuple:
    """Call the LLM API and return the response text and token usage.

    Args:
        system_prompt: System message for the model.
        user_prompt: User message with the task.
        endpoint: API endpoint URL.

    Returns:
        Tuple of (response_text, token_usage_dict).
        token_usage_dict has keys: prompt_tokens, completion_tokens, total_tokens.
    """
    import urllib.request

    endpoint = (endpoint or _model_endpoint()).rstrip("/") + "/chat/completions"

    payload = {
        "model": "local-model",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 4096,
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))
            content = result["choices"][0]["message"]["content"]
            usage = result.get("usage", {})
            token_usage = {
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
            }
            return content, token_usage
    except Exception as e:
        return f"ERROR: Model call failed: {e}", {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}


# ---- Prompt templates ----

PLANNER_SYSTEM_PROMPT = """You are the Planner for the Fantasy Casino auto-project.
Your job is to analyze tasks and produce safe, actionable plans.

CRITICAL: Every step MUST use one of these exact action keywords. The executor
only recognizes these actions:

  create_file — creates a new file. MUST include "file" (path) and "content" keys.
  update_file — modifies an existing file. MUST include "file" (path) and "content" keys.
  delete — moves a file to quarantine. MUST include "file" (path).
  move — moves/renames a file. MUST include "source" and "destination" keys.
  command — runs a shell command. MUST include "command" key. Only safe commands:
           python, pytest, flake8, pycodestyle, grep, wc, cat, ls, echo, date, which.
           NEVER use shell metacharacters (&&, ||, |, >, >>, ;).

Rules:
- Break tasks into small, safe, sequential steps
- Each step should be self-contained and reversible
- Every step MUST have one of the action keywords above
- create_file and update_file MUST include a "content" field (the full file content)
- update_file is only for files that already exist (check if the file exists)
- delete uses quarantine — never removes files permanently
- command steps use shell=False internally, so pass the command as a plain string
  without pipes, redirects, or &&/|| chaining
- Define verification steps for each phase
- Flag any high-risk operations
- If the task is unclear, note what context is missing
- Paths are relative to agent/work/ directory
- For documentation tasks, use create_file with the full markdown content
- For infrastructure tasks (folders, snapshots), break into: create folder files,
  then create metadata JSON files

Output MUST be a JSON object with keys:
{
    "title": "Short plan title",
    "description": "One-paragraph overview",
    "risk_level": "low|medium|high|critical",
    "steps": [
        {
            "step": 1,
            "action": "create_file",
            "files": ["subdir/file.py"],
            "file": "subdir/file.py",
            "content": "#!/usr/bin/env python3\nimport os\n...",
            "verification": "Check file exists and has correct content",
            "reversible": true
        },
        {
            "step": 2,
            "action": "command",
            "command": "python -m flake8 subdir/file.py --max-line-length=120",
            "verification": "Return code is 0, no lint errors"
        }
    ],
    "dependencies": [],
    "estimated_steps": 2,
    "notes": "None"
}"""

PLANNER_USER_PROMPT_TEMPLATE = """Task: {task_title}

Description: {task_description}

Risk class: {risk_class}
Priority: {priority}

Available workspace: agent/work/
Available research context: research/
Available tools: quarantine, snapshots, approval gates, logging
{skill_context}

Please produce a plan for this task. Follow the output format.

Additional context:
{extra_context}"""


def draft_plan(task_title: str, task_description: str, risk_class: str = "low",
               priority: str = "P2", model_endpoint: str = None,
               extra_context: str = "", task_type: str = None) -> dict:
    """Draft a plan for the given task.

    Sends the task details to the LLM and parses the response as JSON.
    Falls back to a simple default plan if the model call fails.

    Args:
        task_title: Short task title.
        task_description: Task description.
        risk_class: Low, medium, or high.
        priority: P0-P9 priority level.
        model_endpoint: LLM API endpoint.
        extra_context: Additional context to include.
        task_type: Optional skill type hint for context injection.

    Returns:
        Plan dict with steps, risk assessment, and metadata.
    """
    system_prompt = PLANNER_SYSTEM_PROMPT

    # Inject skill context
    skill_context = ""
    if task_type or task_description:
        from agent.skills_registry import get_skill_context
        skill_context = get_skill_context(task_description, task_type)

    user_prompt = PLANNER_USER_PROMPT_TEMPLATE.format(
        task_title=task_title,
        task_description=task_description,
        risk_class=risk_class,
        priority=priority,
        extra_context=extra_context or "None",
        skill_context=skill_context,
    )

    response, token_usage = _call_model(system_prompt, user_prompt, endpoint=model_endpoint)

    # Try to parse as JSON
    plan = None
    try:
        # Extract JSON from response (handle markdown code blocks)
        content = response.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            lines = [line for line in lines if not line.strip().startswith("```")]
            content = "\n".join(lines)

        plan = json.loads(content)
        plan["status"] = "drafted"
        plan["created_at"] = _now()
        plan["task_title"] = task_title
        plan["token_usage"] = token_usage
    except (json.JSONDecodeError, KeyError):
        pass

    # Try to extract JSON from mixed text response
    if not plan:
        try:
            # Look for JSON object in the response
            start = response.find("{")
            end = response.rfind("}") + 1
            if start != -1 and end > start:
                json_str = response[start:end]
                plan = json.loads(json_str)
                plan["status"] = "drafted"
                plan["created_at"] = _now()
                plan["task_title"] = task_title
                plan["token_usage"] = token_usage
        except (json.JSONDecodeError, KeyError):
            pass

    # Fallback: create a safe default plan with file creation action
    if not plan:
        import re
        # Extract file paths from task description
        file_paths = re.findall(r'`([^`]+\.ts)`', task_description)
        file_paths = list(dict.fromkeys(file_paths))  # deduplicate preserving order

        steps = []
        for i, file_path in enumerate(file_paths, 1):
            content = f"// Auto-generated file for {task_title}\n// TODO: Implement {task_title}\n"
            steps.append({
                "step": i,
                "action": "create_file",
                "file": file_path,
                "content": content,
                "verification": f"File {file_path} exists",
                "reversible": True,
            })

        if not steps:
            # No files found in description - create a basic structure
            default_file = "product/apps/api/src/services/dummy.ts"
            steps.append({
                "step": 1,
                "action": "create_file",
                "file": default_file,
                "content": f"// Auto-generated for {task_title}\n",
                "verification": f"File {default_file} exists",
                "reversible": True,
            })

        plan = {
            "title": task_title,
            "description": task_description,
            "risk_level": risk_class,
            "status": "drafted",
            "created_at": _now(),
            "task_title": task_title,
            "steps": steps,
            "estimated_steps": len(steps),
            "dependencies": [],
            "notes": "Fallback plan generated (model response could not be parsed)",
            "model_response_preview": response[:200],
        }

    # Save plan to disk
    _save_plan(plan)

    return plan


def _save_plan(plan: dict) -> str:
    """Save a plan to the plans directory.

    Args:
        plan: Plan dict to save.

    Returns:
        Path to the saved plan file.
    """
    plan_id = plan.get("task_title", "plan").replace(" ", "_")[:50]
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"{plan_id}_{timestamp}.json"
    filepath = os.path.join(PLANS_DIR, filename)

    with open(filepath, "w") as f:
        json.dump(plan, f, indent=2, default=str)

    return filepath


def get_plan(plan_path: str = None) -> dict:
    """Load a plan from disk.

    Args:
        plan_path: Path to the plan file. If None, loads the latest plan.

    Returns:
        Plan dict or None.
    """
    if plan_path and os.path.exists(plan_path):
        with open(plan_path) as f:
            return json.load(f)

    # Load the latest plan
    plans = list_plans()
    if plans:
        return plans[0]
    return None


def list_plans() -> list:
    """List all saved plans (newest first).

    Returns:
        List of plan dicts.
    """
    plans = []
    if not os.path.exists(PLANS_DIR):
        return plans

    for filename in sorted(os.listdir(PLANS_DIR), reverse=True):
        if filename.endswith(".json"):
            filepath = os.path.join(PLANS_DIR, filename)
            with open(filepath) as f:
                plans.append(json.load(f))

    return plans
