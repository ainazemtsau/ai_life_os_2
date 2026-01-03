"""
Stream Notifier.

Sends stream events to WebSocket clients and Temporal workflows.
Open/Closed: New notification channels can be added without modifying existing code.
"""
import logging
from typing import Protocol, Any

from .types import StreamRequest, StreamChunk, StreamResult

logger = logging.getLogger(__name__)


class WebSocketSender(Protocol):
    """Protocol for sending WebSocket messages."""

    async def send_to_user(self, user_id: str, data: dict[str, Any]) -> bool: ...


class TemporalSignaler(Protocol):
    """Protocol for signaling Temporal workflows."""

    async def signal_streaming_complete(
        self,
        workflow_id: str,
        result: dict[str, Any],
    ) -> None: ...


class StreamNotifier:
    """
    Sends stream events to appropriate channels.

    Responsibilities:
    - Format events for WebSocket protocol
    - Send events to correct user
    - Signal Temporal workflow on completion

    All event types follow the stream.* naming convention.
    """

    def __init__(
        self,
        websocket_sender: WebSocketSender,
        temporal_signaler: TemporalSignaler,
    ):
        self._websocket = websocket_sender
        self._temporal = temporal_signaler

    async def notify_start(self, request: StreamRequest) -> None:
        """
        Notify client that streaming has started.

        Event type: stream.start
        """
        await self._websocket.send_to_user(
            request.user_id,
            {
                "type": "stream.start",
                "requestId": request.request_id,
            },
        )
        logger.debug("Sent stream.start for request: %s", request.request_id)

    async def notify_chunk(
        self,
        request: StreamRequest,
        chunk: StreamChunk,
    ) -> None:
        """
        Send content chunk to client.

        Event type: stream.chunk
        """
        await self._websocket.send_to_user(
            request.user_id,
            {
                "type": "stream.chunk",
                "requestId": request.request_id,
                "delta": chunk.delta,
                "accumulated": chunk.accumulated,
            },
        )

    async def notify_complete(
        self,
        request: StreamRequest,
        result: StreamResult,
    ) -> None:
        """
        Notify completion to client and Temporal workflow.

        Event type: stream.end
        Also signals Temporal workflow to continue.
        """
        # Send to client
        await self._websocket.send_to_user(
            request.user_id,
            {
                "type": "stream.end",
                "requestId": request.request_id,
                "message": {
                    "id": result.message_id,
                    "role": "assistant",
                    "content": result.content,
                    "agentName": result.agent_name,
                },
            },
        )
        logger.debug("Sent stream.end for request: %s", request.request_id)

        # Signal Temporal workflow
        await self._temporal.signal_streaming_complete(
            request.workflow_id,
            {
                "request_id": request.request_id,
                "content": result.content,
                "agent_name": result.agent_name,
            },
        )
        logger.debug(
            "Signaled Temporal workflow %s for request: %s",
            request.workflow_id,
            request.request_id,
        )

    async def notify_error(
        self,
        request: StreamRequest,
        error: str,
        recoverable: bool = False,
    ) -> None:
        """
        Notify client of stream error.

        Event type: stream.error
        """
        await self._websocket.send_to_user(
            request.user_id,
            {
                "type": "stream.error",
                "requestId": request.request_id,
                "error": error,
                "recoverable": recoverable,
            },
        )
        logger.warning(
            "Sent stream.error for request %s: %s",
            request.request_id,
            error,
        )

        # Also signal Temporal with error
        await self._temporal.signal_streaming_complete(
            request.workflow_id,
            {
                "request_id": request.request_id,
                "error": error,
            },
        )
