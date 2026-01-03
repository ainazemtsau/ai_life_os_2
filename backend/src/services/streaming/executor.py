"""
Stream Executor.

Executes LLM streaming using PydanticAI agents.
Single Responsibility: Only handles LLM execution, not notification.
"""
import logging
import uuid
from typing import AsyncIterator, Optional, Protocol

from pydantic_ai import Agent

from src.ai.context import AgentDeps

from .types import StreamRequest, StreamChunk, StreamResult, StreamState

logger = logging.getLogger(__name__)


class AgentProvider(Protocol):
    """Protocol for providing configured agents."""

    def get_config(self, name: str): ...
    def _create_workflow_agent(self, config): ...
    def _resolve_model(self, model_config: Optional[str]) -> str: ...


class StreamExecutor:
    """
    Executes LLM streaming operations.

    Uses PydanticAI's run_stream() for real-time token streaming.
    Manages stream state and converts to StreamChunk events.

    Note: For streaming, we use text-only agents because PydanticAI's
    stream_text() requires non-structured output. Workflow signals
    are extracted separately after streaming completes.
    """

    def __init__(self, agent_provider: AgentProvider):
        self._agent_provider = agent_provider
        self._active_states: dict[str, StreamState] = {}

    def _create_streaming_agent(self, config, deps: AgentDeps) -> Agent:
        """
        Create a text-only agent for streaming.

        Unlike workflow agents with structured output, streaming agents
        return plain text which allows stream_text() to work.
        """
        model = self._agent_provider._resolve_model(config.model)

        agent: Agent[AgentDeps, str] = Agent(
            model=model,
            deps_type=AgentDeps,
            # No output_type = text-only output
        )

        # Add system prompt for streaming (text-only, no workflow signals)
        @agent.system_prompt
        async def streaming_system_prompt(ctx) -> str:
            agent_deps: AgentDeps = ctx.deps
            base_prompt = config.system_prompt

            # NO workflow_prompt - streaming agent is for text output only
            # Workflow signals are handled separately after streaming completes

            # Get data context
            collections_summary = agent_deps.get_collections_summary()
            memories_summary = agent_deps.get_memories_summary()

            return f"""{base_prompt}

## Available Data

{collections_summary}

{memories_summary}

Respond naturally to the user. Focus on the conversation content.
"""

        return agent

    async def execute(
        self,
        request: StreamRequest,
        deps: AgentDeps,
    ) -> AsyncIterator[StreamChunk]:
        """
        Execute streaming LLM call.

        Yields StreamChunk for each token received from LLM.

        Args:
            request: Stream request with context
            deps: Agent dependencies

        Yields:
            StreamChunk with delta and accumulated content
        """
        state = StreamState(request_id=request.request_id)
        self._active_states[request.request_id] = state

        try:
            config = self._agent_provider.get_config(request.agent_name)
            if not config:
                raise ValueError(f"Agent '{request.agent_name}' not found")

            # Use text-only agent for streaming (not workflow agent with structured output)
            agent = self._create_streaming_agent(config, deps)

            logger.info(
                "Starting stream for request %s with agent %s",
                request.request_id,
                request.agent_name,
            )

            async with agent.run_stream(request.user_message, deps=deps) as stream:
                async for accumulated_text in stream.stream_text():
                    yield state.update_from_accumulated(accumulated_text)

            logger.info(
                "Stream completed for request %s, total chars: %d",
                request.request_id,
                len(state.accumulated_content),
            )

        except Exception as e:
            logger.exception("Stream execution failed: %s", e)
            state.fail(str(e))
            raise

    def get_result(
        self,
        request_id: str,
        agent_name: str,
    ) -> StreamResult:
        """
        Get final result for completed stream.

        Args:
            request_id: ID of the completed stream
            agent_name: Name of the agent that produced result

        Returns:
            StreamResult with message details
        """
        state = self._active_states.get(request_id)
        if not state:
            raise ValueError(f"No active state for request: {request_id}")

        message_id = str(uuid.uuid4())
        result = state.complete(message_id, agent_name)

        # Cleanup state
        del self._active_states[request_id]

        return result

    def get_accumulated_content(self, request_id: str) -> Optional[str]:
        """Get current accumulated content for a stream."""
        state = self._active_states.get(request_id)
        return state.accumulated_content if state else None

    def cancel(self, request_id: str) -> bool:
        """
        Cancel an active stream.

        Returns True if stream was cancelled, False if not found.
        """
        state = self._active_states.pop(request_id, None)
        if state:
            state.fail("Cancelled by user")
            return True
        return False
