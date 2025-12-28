"""
Context structures for AI Agent.

AgentContext - data that is available during agent execution
AgentDeps - dependencies injected into PydanticAI RunContext
"""
from dataclasses import dataclass, field
from typing import Optional

from fastapi import WebSocket


@dataclass
class AgentContext:
    """
    Context data available to the agent during execution.

    This is populated before calling the agent and contains
    all the information needed for the agent to make decisions.
    """

    user_id: str
    collections: list[dict] = field(default_factory=list)
    recent_records: list[dict] = field(default_factory=list)
    memories: list[str] = field(default_factory=list)


@dataclass
class AgentDeps:
    """
    Dependencies injected into PydanticAI agent via RunContext.

    These are the actual services/objects the agent tools can use.
    """

    user_id: str
    websocket: Optional[WebSocket] = None
    context: Optional[AgentContext] = None

    def get_collections_summary(self) -> str:
        """Get a summary of available collections for the system prompt."""
        if not self.context or not self.context.collections:
            return "No collections exist yet."

        lines = []
        for col in self.context.collections:
            name = col.get("name", "unknown")
            schema = col.get("schema", [])
            fields = [f.get("name", "") for f in schema if f.get("name")]
            fields_str = ", ".join(fields) if fields else "no fields"
            lines.append(f"- {name}: {fields_str}")

        return "Existing collections:\n" + "\n".join(lines)

    def get_memories_summary(self) -> str:
        """Get a summary of relevant memories for the system prompt."""
        if not self.context or not self.context.memories:
            return "No relevant memories."

        return "Relevant memories:\n" + "\n".join(
            f"- {m}" for m in self.context.memories[:10]
        )
