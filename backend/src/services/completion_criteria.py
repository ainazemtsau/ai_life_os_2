"""
Completion Criteria Checkers for Workflow Steps.

Registry pattern for extensible criteria validation.
Each step in a workflow can have completion criteria that must be satisfied
before transitioning to the next step.
"""
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class CriteriaResult:
    """Result of a criteria check."""

    satisfied: bool
    missing: list[str] = field(default_factory=list)
    data: dict[str, Any] = field(default_factory=dict)


class CompletionCriteriaChecker(ABC):
    """Base class for completion criteria checkers."""

    @abstractmethod
    async def check(
        self,
        workflow_instance_id: str,
        user_id: str,
        signal_data: dict,
        params: dict,
    ) -> CriteriaResult:
        """
        Check if completion criteria are satisfied.

        Args:
            workflow_instance_id: The workflow instance ID
            user_id: The user ID
            signal_data: Data from the agent's workflow_signal
            params: Parameters from the completion_criteria config

        Returns:
            CriteriaResult with satisfied status and details
        """
        pass


class AgentSignalChecker(CompletionCriteriaChecker):
    """
    Simple checker that only requires the agent to signal complete_step.

    Used for steps where the agent's judgment is sufficient.
    """

    async def check(
        self,
        workflow_instance_id: str,
        user_id: str,
        signal_data: dict,
        params: dict,
    ) -> CriteriaResult:
        # If we're here, agent already sent complete_step
        return CriteriaResult(satisfied=True)


class AgentSignalWithMemoryChecker(CompletionCriteriaChecker):
    """
    Checker that requires agent signal AND minimum facts in Mem0.

    Used for discovery-type steps where we need to ensure
    enough information has been gathered about the user.

    Params:
        min_facts: Minimum number of facts required (default: 1)
        category: Optional category/topic to search for
    """

    async def check(
        self,
        workflow_instance_id: str,
        user_id: str,
        signal_data: dict,
        params: dict,
    ) -> CriteriaResult:
        min_facts = params.get("min_facts", 1)
        category = params.get("category")

        try:
            from src.services.memory import MemoryService

            memory_service = MemoryService(user_id=user_id)

            if not memory_service.is_available:
                # Graceful degradation - if Mem0 unavailable, pass the check
                logger.warning(
                    "Mem0 unavailable, skipping memory check for workflow %s",
                    workflow_instance_id,
                )
                return CriteriaResult(
                    satisfied=True,
                    data={"memory_check_skipped": True},
                )

            # Search for facts in the category
            query = category if category else "user preferences priorities goals"
            facts = await memory_service.search(query, limit=min_facts + 5)

            if len(facts) >= min_facts:
                return CriteriaResult(
                    satisfied=True,
                    data={"facts_count": len(facts)},
                )

            return CriteriaResult(
                satisfied=False,
                missing=[
                    f"Need at least {min_facts} facts about {category or 'user'}, "
                    f"have {len(facts)}"
                ],
                data={"facts_count": len(facts)},
            )

        except Exception as e:
            logger.exception(
                "Error checking memory criteria for workflow %s: %s",
                workflow_instance_id,
                e,
            )
            # On error, allow transition but log the issue
            return CriteriaResult(
                satisfied=True,
                data={"memory_check_error": str(e)},
            )


class AgentSignalWithWidgetChecker(CompletionCriteriaChecker):
    """
    Checker that requires agent signal AND items in a collection.

    Used for brain_dump-type steps where we need to ensure
    the user has added items to inbox or completed a widget.

    Params:
        widget_type: Type of widget (for reference, not currently validated)
        min_items: Minimum number of items required (default: 1)
        collection: Collection to check (default: "inbox_items")
    """

    async def check(
        self,
        workflow_instance_id: str,
        user_id: str,
        signal_data: dict,
        params: dict,
    ) -> CriteriaResult:
        min_items = params.get("min_items", 1)
        collection = params.get("collection", "inbox_items")

        try:
            from src.services.pocketbase import pocketbase

            result = await pocketbase.list_records(
                collection,
                filter=f'user_id="{user_id}"',
            )
            items = result.get("items", [])

            if len(items) >= min_items:
                return CriteriaResult(
                    satisfied=True,
                    data={"items_count": len(items)},
                )

            return CriteriaResult(
                satisfied=False,
                missing=[
                    f"Need at least {min_items} items in {collection}, "
                    f"have {len(items)}"
                ],
                data={"items_count": len(items)},
            )

        except Exception as e:
            logger.exception(
                "Error checking widget criteria for workflow %s: %s",
                workflow_instance_id,
                e,
            )
            # On error, allow transition but log the issue
            return CriteriaResult(
                satisfied=True,
                data={"widget_check_error": str(e)},
            )


class AutoCompleteChecker(CompletionCriteriaChecker):
    """
    Checker that always returns satisfied.

    Used for final steps that auto-complete when reached.
    """

    async def check(
        self,
        workflow_instance_id: str,
        user_id: str,
        signal_data: dict,
        params: dict,
    ) -> CriteriaResult:
        return CriteriaResult(satisfied=True)


# Registry of checkers
_checkers: dict[str, CompletionCriteriaChecker] = {
    "agent_signal": AgentSignalChecker(),
    "agent_signal_memory": AgentSignalWithMemoryChecker(),
    "agent_signal_widget": AgentSignalWithWidgetChecker(),
    "auto": AutoCompleteChecker(),
}


def register_checker(name: str, checker: CompletionCriteriaChecker) -> None:
    """Register a custom completion criteria checker."""
    _checkers[name] = checker
    logger.info("Registered completion criteria checker: %s", name)


def get_checker(name: str) -> Optional[CompletionCriteriaChecker]:
    """Get a checker by name."""
    return _checkers.get(name)


async def check_completion_criteria(
    criteria_config: dict,
    workflow_instance_id: str,
    user_id: str,
    signal_data: dict,
) -> CriteriaResult:
    """
    Check if completion criteria are satisfied.

    Args:
        criteria_config: The completion_criteria config from workflow step
        workflow_instance_id: The workflow instance ID
        user_id: The user ID
        signal_data: Data from the agent's workflow_signal

    Returns:
        CriteriaResult with check results
    """
    criteria_type = criteria_config.get("type", "agent_signal")
    params = criteria_config.get("params", {})

    checker = _checkers.get(criteria_type)
    if not checker:
        logger.warning(
            "Unknown criteria type '%s', defaulting to agent_signal",
            criteria_type,
        )
        checker = _checkers["agent_signal"]

    try:
        result = await checker.check(
            workflow_instance_id,
            user_id,
            signal_data,
            params,
        )
        logger.debug(
            "Criteria check for workflow %s: type=%s, satisfied=%s",
            workflow_instance_id,
            criteria_type,
            result.satisfied,
        )
        return result

    except Exception as e:
        logger.exception(
            "Error in criteria checker '%s' for workflow %s: %s",
            criteria_type,
            workflow_instance_id,
            e,
        )
        return CriteriaResult(
            satisfied=False,
            missing=[f"Criteria check failed: {str(e)}"],
        )
