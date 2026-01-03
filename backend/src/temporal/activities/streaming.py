"""
Streaming Activity.

Triggers LLM streaming outside Temporal sandbox.
The activity returns immediately; streaming runs in background.
"""
import logging
from dataclasses import dataclass, field

from temporalio import activity

logger = logging.getLogger(__name__)


@dataclass
class StartStreamingInput:
    """Input for starting a stream."""

    request_id: str
    user_id: str
    conversation_id: str
    workflow_id: str
    agent_name: str
    user_message: str
    workflow_context: dict = field(default_factory=dict)
    collections: list[dict] = field(default_factory=list)
    memories: list[str] = field(default_factory=list)


@activity.defn
async def start_streaming(input: StartStreamingInput) -> bool:
    """
    Start LLM streaming in background.

    This activity:
    1. Creates StreamRequest from input
    2. Builds AgentDeps for the agent
    3. Triggers StreamingOrchestrator.start_stream()
    4. Returns immediately (non-blocking)

    The streaming orchestrator will:
    - Send stream.start event
    - Send stream.chunk events as content arrives
    - Send stream.end event when complete
    - Signal workflow via streaming_complete signal

    Returns:
        True if streaming was started successfully
    """
    # Import here to avoid circular imports and sandbox issues
    from src.services.streaming import StreamRequest, StreamingOrchestrator
    from src.services.streaming.executor import StreamExecutor
    from src.services.streaming.notifier import StreamNotifier
    from src.services.connection_manager import manager
    from src.services.agent import agent_service
    from src.ai.context import AgentDeps, AgentContext, WorkflowContext
    from src.temporal.client import get_temporal_client

    logger.info(
        "Starting stream for request %s, agent '%s', user '%s'",
        input.request_id,
        input.agent_name,
        input.user_id,
    )

    try:
        # Build StreamRequest
        request = StreamRequest(
            request_id=input.request_id,
            user_id=input.user_id,
            conversation_id=input.conversation_id,
            workflow_id=input.workflow_id,
            agent_name=input.agent_name,
            user_message=input.user_message,
            context=input.workflow_context,
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

        # Build AgentDeps
        deps = AgentDeps(
            user_id=input.user_id,
            websocket=None,
            context=agent_context,
            workflow_context=workflow_context,
        )

        # Create streaming components with dependencies
        executor = StreamExecutor(agent_service)

        # Create temporal signaler adapter
        class TemporalSignalerAdapter:
            async def signal_streaming_complete(
                self, workflow_id: str, result: dict
            ) -> None:
                client = await get_temporal_client()
                handle = client.get_workflow_handle(workflow_id)
                await handle.signal("streaming_complete", result)

        notifier = StreamNotifier(
            websocket_sender=manager,
            temporal_signaler=TemporalSignalerAdapter(),
        )

        orchestrator = StreamingOrchestrator(executor, notifier)

        # Start streaming (returns immediately)
        await orchestrator.start_stream(request, deps)

        logger.info("Streaming started for request %s", input.request_id)
        return True

    except Exception as e:
        logger.exception(
            "Failed to start streaming for request %s: %s",
            input.request_id,
            e,
        )
        return False
