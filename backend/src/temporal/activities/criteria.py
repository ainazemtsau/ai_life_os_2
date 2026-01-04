"""
Criteria Activities.

Check step completion criteria for workflow transitions.
"""

import logging
from dataclasses import dataclass, field
from typing import Any

from temporalio import activity

logger = logging.getLogger(__name__)


@dataclass
class CheckCriteriaInput:
    """Input for criteria check activity."""

    criteria_config: dict[str, Any]
    instance_id: str
    user_id: str
    signal_data: dict[str, Any] = field(default_factory=dict)


@dataclass
class CheckCriteriaResult:
    """Result of criteria check."""

    satisfied: bool
    missing: list[str] = field(default_factory=list)
    data: dict[str, Any] = field(default_factory=dict)


@activity.defn
async def check_step_criteria(input: CheckCriteriaInput) -> CheckCriteriaResult:
    """
    Check if step completion criteria are satisfied.

    Uses the completion_criteria service to validate that
    all requirements for step transition are met.

    Args:
        input: Criteria check parameters

    Returns:
        CheckCriteriaResult with satisfaction status and details.
    """
    from src.services.completion_criteria import check_completion_criteria

    logger.debug(
        "Checking criteria for workflow '%s', type: %s",
        input.instance_id,
        input.criteria_config.get("type", "agent_signal"),
    )

    try:
        result = await check_completion_criteria(
            criteria_config=input.criteria_config,
            workflow_instance_id=input.instance_id,
            user_id=input.user_id,
            signal_data=input.signal_data,
        )

        logger.info(
            "Criteria check for '%s': satisfied=%s, missing=%s",
            input.instance_id,
            result.satisfied,
            result.missing if not result.satisfied else "none",
        )

        return CheckCriteriaResult(
            satisfied=result.satisfied,
            missing=result.missing,
            data=result.data,
        )

    except Exception as e:
        logger.exception("Failed to check criteria: %s", e)
        return CheckCriteriaResult(
            satisfied=False,
            missing=[f"Criteria check failed: {str(e)}"],
            data={},
        )
