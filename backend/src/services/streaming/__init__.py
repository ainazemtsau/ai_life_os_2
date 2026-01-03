"""
Streaming Services Module.

Provides infrastructure for real-time LLM streaming.

Architecture:
- StreamExecutor: Handles LLM streaming via PydanticAI
- StreamNotifier: Sends events to WebSocket and Temporal
- StreamingOrchestrator: Coordinates execution flow

Usage:
    from src.services.streaming import (
        StreamingOrchestrator,
        StreamRequest,
    )

    orchestrator = StreamingOrchestrator(executor, notifier)
    await orchestrator.start_stream(request, deps)
"""

from .types import (
    StreamRequest,
    StreamChunk,
    StreamResult,
    StreamError,
    StreamState,
)
from .executor import StreamExecutor
from .notifier import StreamNotifier
from .orchestrator import StreamingOrchestrator

__all__ = [
    # Types
    "StreamRequest",
    "StreamChunk",
    "StreamResult",
    "StreamError",
    "StreamState",
    # Services
    "StreamExecutor",
    "StreamNotifier",
    "StreamingOrchestrator",
]
