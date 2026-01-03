"""
Streaming Mixin for Temporal Workflows.

Adds streaming capabilities to workflows using composition pattern.
Handles signal-based communication with external streaming service.
"""
from dataclasses import dataclass
from datetime import timedelta
from typing import Optional

from temporalio import workflow

from src.config import streaming_config


@dataclass
class StreamingResult:
    """
    Result received from streaming service.

    Attributes:
        request_id: Original request identifier
        content: Generated content from LLM
        agent_name: Name of agent that generated content
        error: Error message if streaming failed
    """

    request_id: str
    content: str = ""
    agent_name: str = ""
    error: Optional[str] = None

    @property
    def is_error(self) -> bool:
        """Check if result contains an error."""
        return self.error is not None

    @classmethod
    def from_dict(cls, data: dict) -> "StreamingResult":
        """Create from signal payload dict."""
        return cls(
            request_id=data.get("request_id", ""),
            content=data.get("content", ""),
            agent_name=data.get("agent_name", ""),
            error=data.get("error"),
        )


class StreamingMixin:
    """
    Mixin providing streaming support for Temporal workflows.

    This mixin enables workflows to wait for streaming results
    from an external streaming service. The streaming service
    runs outside Temporal (for compatibility with LLM streaming)
    and signals the workflow when complete.

    Usage:
        @workflow.defn
        class MyWorkflow(StreamingMixin):
            def __init__(self):
                super().__init__()
                self._init_streaming()

            async def run(self, ...):
                request_id = str(workflow.uuid4())
                # ... trigger streaming service ...
                result = await self.wait_for_stream(request_id)

    Note: This class should be used as a mixin, not standalone.
    """

    _streaming_results: dict[str, StreamingResult]
    _streaming_initialized: bool

    def _init_streaming(self) -> None:
        """Initialize streaming state. Call from __init__."""
        self._streaming_results = {}
        self._streaming_initialized = True

    @workflow.signal
    async def streaming_complete(self, result: dict) -> None:
        """
        Signal handler for streaming completion.

        Called by streaming service when LLM streaming finishes.
        Stores result for retrieval by wait_for_stream().

        Args:
            result: Dict with request_id, content, agent_name, and optional error
        """
        if not getattr(self, "_streaming_initialized", False):
            workflow.logger.warning("Streaming not initialized, initializing now")
            self._init_streaming()

        streaming_result = StreamingResult.from_dict(result)
        self._streaming_results[streaming_result.request_id] = streaming_result

        workflow.logger.debug(
            "Received streaming_complete for request: %s",
            streaming_result.request_id,
        )

    async def wait_for_stream(
        self,
        request_id: str,
        timeout: Optional[timedelta] = None,
    ) -> StreamingResult:
        """
        Wait for streaming to complete.

        Blocks workflow until streaming service signals completion
        or timeout is reached.

        Args:
            request_id: ID of the stream to wait for
            timeout: Max wait time (defaults to streaming_config value)

        Returns:
            StreamingResult with content or error

        Raises:
            asyncio.TimeoutError: If timeout exceeded
        """
        effective_timeout = timeout or streaming_config.stream_completion_timeout

        await workflow.wait_condition(
            lambda: request_id in self._streaming_results,
            timeout=effective_timeout,
        )

        result = self._streaming_results.pop(request_id)

        workflow.logger.debug(
            "Completed wait_for_stream for request: %s (error=%s)",
            request_id,
            result.is_error,
        )

        return result

    def has_pending_stream(self, request_id: str) -> bool:
        """Check if a stream result is pending for request."""
        return request_id in self._streaming_results
