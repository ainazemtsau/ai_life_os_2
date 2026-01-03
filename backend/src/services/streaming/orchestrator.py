"""
Streaming Orchestrator.

Coordinates LLM streaming between Temporal workflow and WebSocket.
Single Responsibility: Only coordination, delegates work to executor and notifier.
"""
import asyncio
import logging
from typing import Optional

from src.ai.context import AgentDeps

from .types import StreamRequest
from .executor import StreamExecutor
from .notifier import StreamNotifier

logger = logging.getLogger(__name__)


class StreamingOrchestrator:
    """
    Orchestrates LLM streaming outside Temporal sandbox.

    Workflow:
    1. Temporal activity triggers stream start
    2. Orchestrator runs LLM streaming via executor
    3. Chunks sent to client via notifier
    4. Completion signaled back to Temporal

    This architecture allows streaming while maintaining
    Temporal's durability for workflow orchestration.
    """

    def __init__(
        self,
        executor: StreamExecutor,
        notifier: StreamNotifier,
    ):
        self._executor = executor
        self._notifier = notifier
        self._active_streams: dict[str, asyncio.Task] = {}

    async def start_stream(
        self,
        request: StreamRequest,
        deps: AgentDeps,
    ) -> None:
        """
        Start streaming in background task.

        Non-blocking - returns immediately after scheduling.
        Stream progress is sent via WebSocket.
        Completion signals Temporal workflow.

        Args:
            request: Stream request with all context
            deps: Agent dependencies for LLM
        """
        if request.request_id in self._active_streams:
            logger.warning(
                "Stream %s already active, ignoring duplicate",
                request.request_id,
            )
            return

        task = asyncio.create_task(
            self._run_stream(request, deps),
            name=f"stream-{request.request_id}",
        )
        self._active_streams[request.request_id] = task
        logger.info("Started stream: %s", request.request_id)

    async def cancel_stream(self, request_id: str) -> bool:
        """
        Cancel active stream.

        Returns True if stream was cancelled, False if not found.
        """
        task = self._active_streams.pop(request_id, None)
        if task:
            task.cancel()
            self._executor.cancel(request_id)
            logger.info("Cancelled stream: %s", request_id)
            return True
        return False

    def is_active(self, request_id: str) -> bool:
        """Check if stream is currently active."""
        return request_id in self._active_streams

    @property
    def active_count(self) -> int:
        """Number of currently active streams."""
        return len(self._active_streams)

    async def _run_stream(
        self,
        request: StreamRequest,
        deps: AgentDeps,
    ) -> None:
        """
        Execute streaming pipeline.

        Steps:
        1. Notify client of stream start
        2. Execute LLM streaming, sending chunks
        3. On completion, get result and notify
        4. On error, notify client and Temporal
        """
        try:
            # Notify start
            await self._notifier.notify_start(request)

            # Execute streaming
            async for chunk in self._executor.execute(request, deps):
                await self._notifier.notify_chunk(request, chunk)

            # Get final result
            result = self._executor.get_result(
                request.request_id,
                request.agent_name,
            )

            # Notify completion
            await self._notifier.notify_complete(request, result)

        except asyncio.CancelledError:
            await self._notifier.notify_error(
                request,
                error="Stream cancelled",
                recoverable=True,
            )

        except Exception as e:
            logger.exception("Stream %s failed: %s", request.request_id, e)
            await self._notifier.notify_error(
                request,
                error=str(e),
                recoverable=False,
            )

        finally:
            self._active_streams.pop(request.request_id, None)
