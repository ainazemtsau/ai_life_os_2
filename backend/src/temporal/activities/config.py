"""
Configuration Activities.

Load workflow and step configurations for Temporal workflows.
"""

import logging

from temporalio import activity

logger = logging.getLogger(__name__)


@activity.defn
async def get_step_configs(workflow_name: str) -> dict[str, dict]:
    """
    Get step configurations for a workflow.

    Args:
        workflow_name: Name of the workflow (e.g., "onboarding")

    Returns:
        Dict mapping step name to step config dict.
        Each step config contains: name, agent, next_step, is_required,
        min_messages, max_messages, completion_criteria.
    """
    from src.services.workflow import WorkflowService

    logger.debug("Loading step configs for workflow: %s", workflow_name)

    configs = WorkflowService.get_step_configs(workflow_name)

    if not configs:
        logger.warning("No step configs found for workflow: %s", workflow_name)
        return {}

    logger.info(
        "Loaded %d step configs for workflow '%s'",
        len(configs),
        workflow_name,
    )

    return configs
