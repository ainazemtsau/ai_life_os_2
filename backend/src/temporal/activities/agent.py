"""
Agent Activity.

Wraps PydanticAI agent execution as a Temporal activity.
"""
import logging
from dataclasses import dataclass, field, asdict
from typing import Any, Optional

from temporalio import activity

logger = logging.getLogger(__name__)


@dataclass
class AgentInput:
    """Input for agent activity."""

    agent_name: str
    message: str
    user_id: str
    workflow_context: dict = field(default_factory=dict)
    collections: list[dict] = field(default_factory=list)
    memories: list[str] = field(default_factory=list)


@dataclass
class AgentResult:
    """Result from agent activity."""

    content: str
    workflow_signal: dict = field(default_factory=dict)
    metadata: dict = field(default_factory=dict)


@activity.defn
async def run_workflow_agent(input: AgentInput) -> AgentResult:
    """
    Execute a PydanticAI agent within workflow context.

    This activity:
    1. Rebuilds AgentDeps from serialized input
    2. Rebuilds WorkflowContext from dict
    3. Calls agent_service.run_workflow_agent()
    4. Returns serializable result

    Note: WebSocket is not passed to activity (not serializable).
    Response delivery is handled by notify_user activity.
    """
    # Import here to avoid circular imports
    from src.services.agent import agent_service
    from src.ai.context import AgentDeps, AgentContext, WorkflowContext
    from src.models.workflow_signal import WorkflowAction

    logger.info(
        "Running agent '%s' for user '%s' on step '%s'",
        input.agent_name,
        input.user_id,
        input.workflow_context.get("current_step", "unknown"),
    )

    # Rebuild WorkflowContext from dict
    workflow_context = None
    if input.workflow_context:
        workflow_context = WorkflowContext(
            workflow_id=input.workflow_context.get("workflow_id", ""),
            instance_id=input.workflow_context.get("instance_id", ""),
            current_step=input.workflow_context.get("current_step", ""),
            step_agent=input.workflow_context.get("step_agent", input.agent_name),
            is_required=input.workflow_context.get("is_required", True),
            steps_completed=input.workflow_context.get("steps_completed", []),
            step_data=input.workflow_context.get("step_data", {}),
            shared=input.workflow_context.get("shared", {}),
        )

    # Build AgentContext
    agent_context = AgentContext(
        user_id=input.user_id,
        collections=input.collections,
        recent_records=[],
        memories=input.memories,
    )

    # Build AgentDeps (without websocket - not serializable)
    deps = AgentDeps(
        user_id=input.user_id,
        websocket=None,  # Will use notify activity for responses
        context=agent_context,
        workflow_context=workflow_context,
    )

    try:
        # Run the agent
        response = await agent_service.run_workflow_agent(
            agent_name=input.agent_name,
            message=input.message,
            deps=deps,
        )

        if response is None:
            logger.error("Agent '%s' not found", input.agent_name)
            return AgentResult(
                content="I'm having trouble processing your request. Please try again.",
                workflow_signal={"action": WorkflowAction.STAY.value, "data": {}, "reason": "Agent not found"},
                metadata={"error": "Agent not found"},
            )

        # Serialize workflow signal
        signal_dict = {}
        if response.workflow_signal:
            signal_dict = {
                "action": response.workflow_signal.action.value,
                "data": response.workflow_signal.data,
                "reason": response.workflow_signal.reason,
            }

        logger.info(
            "Agent '%s' completed with signal: %s",
            input.agent_name,
            signal_dict.get("action", "none"),
        )

        return AgentResult(
            content=response.content,
            workflow_signal=signal_dict,
            metadata=response.metadata,
        )

    except Exception as e:
        logger.exception("Error running agent '%s': %s", input.agent_name, e)
        return AgentResult(
            content="I encountered an issue. Let's continue our conversation.",
            workflow_signal={"action": WorkflowAction.STAY.value, "data": {}, "reason": str(e)},
            metadata={"error": str(e)},
        )
