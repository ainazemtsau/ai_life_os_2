"""
Streaming Types.

Data structures for LLM streaming operations.
All types are immutable dataclasses for thread safety.
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class StreamRequest:
    """
    Immutable request for starting a stream.

    Contains all context needed to execute LLM streaming
    and notify both client and Temporal workflow.
    """

    request_id: str
    user_id: str
    conversation_id: str
    workflow_id: str
    agent_name: str
    user_message: str
    context: dict = field(default_factory=dict)


@dataclass(frozen=True)
class StreamChunk:
    """
    Single chunk of streamed content.

    Attributes:
        delta: New content since last chunk
        accumulated: Full content accumulated so far
    """

    delta: str
    accumulated: str


@dataclass(frozen=True)
class StreamResult:
    """
    Final result of completed stream.

    Contains the complete message ready for storage.
    """

    message_id: str
    content: str
    agent_name: str


@dataclass(frozen=True)
class StreamError:
    """
    Error that occurred during streaming.

    Attributes:
        error: Error message
        recoverable: Whether client can retry
    """

    error: str
    recoverable: bool = False


@dataclass
class StreamState:
    """
    Mutable state of an active stream.

    Tracks accumulated content during streaming.
    """

    request_id: str
    accumulated_content: str = ""
    is_complete: bool = False
    error: Optional[str] = None

    def update_from_accumulated(self, new_accumulated: str) -> StreamChunk:
        """
        Update state from accumulated content and compute delta.

        PydanticAI stream_text() returns accumulated text, not delta.
        This method computes the delta from the difference.
        """
        delta = new_accumulated[len(self.accumulated_content) :]
        self.accumulated_content = new_accumulated
        return StreamChunk(delta=delta, accumulated=new_accumulated)

    def append(self, delta: str) -> StreamChunk:
        """Append delta and return chunk with accumulated content."""
        self.accumulated_content += delta
        return StreamChunk(delta=delta, accumulated=self.accumulated_content)

    def complete(self, message_id: str, agent_name: str) -> StreamResult:
        """Mark stream as complete and return result."""
        self.is_complete = True
        return StreamResult(
            message_id=message_id,
            content=self.accumulated_content,
            agent_name=agent_name,
        )

    def fail(self, error: str) -> StreamError:
        """Mark stream as failed and return error."""
        self.is_complete = True
        self.error = error
        return StreamError(error=error, recoverable=False)
