"""
Skills Registry — stub implementation.

Provides context about available skills for task planning.
Currently a no-op since the skills system is not yet implemented.
"""


def get_skill_context(task_description: str, task_type: str = None) -> str:
    """Return formatted skill context for a given task.
    
    Currently returns empty string — skills system is not yet implemented.
    
    Args:
        task_description: Description of the task being planned.
        task_type: Type/category of the task.
    
    Returns:
        Formatted skill context string (empty for now).
    """
    return ""
