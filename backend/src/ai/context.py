"""
Context structures for AI Agent.

AgentContext - data that is available during agent execution
AgentDeps - dependencies injected into PydanticAI RunContext
WorkflowContext - workflow state passed to agents
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
class WorkflowContext:
    """
    Workflow context passed to agents.

    Contains information about the current workflow state
    so agents can make decisions about step completion.
    """

    workflow_id: str
    instance_id: str
    current_step: str
    step_agent: str
    is_required: bool
    steps_completed: list[str] = field(default_factory=list)
    step_data: dict = field(default_factory=dict)
    shared: dict = field(default_factory=dict)


@dataclass
class AgentDeps:
    """
    Dependencies injected into PydanticAI agent via RunContext.

    These are the actual services/objects the agent tools can use.
    """

    user_id: str
    websocket: Optional[WebSocket] = None
    context: Optional[AgentContext] = None
    workflow_context: Optional[WorkflowContext] = None

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

    def get_workflow_prompt_context(self) -> str:
        """
        Get workflow context formatted for inclusion in system prompt.

        Provides instructions to the agent about workflow signals.
        """
        if not self.workflow_context:
            return ""

        wc = self.workflow_context
        completed_str = ", ".join(wc.steps_completed) if wc.steps_completed else "none"

        return f"""
## Workflow Context

You are handling step: **{wc.current_step}**
Steps completed: {completed_str}
This step is {'REQUIRED' if wc.is_required else 'optional'}.

## Workflow Signal Instructions

You MUST include a workflow_signal in your response to indicate what should happen next:

- **complete_step**: Use when the user has satisfied this step's goals and is ready to proceed
- **stay**: Use when you need to continue the conversation on this step
- **need_input**: Use when waiting for specific input (e.g., a form or widget)

In the "data" field, include any information you learned that should be saved to workflow context.
In the "reason" field, briefly explain why you chose this action.

Example signals:
- User is engaged and answered questions → complete_step
- User has more to say or you have more questions → stay
- User needs to fill out a form → need_input
"""
