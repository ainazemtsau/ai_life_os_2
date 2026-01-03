"""
Workflow Signal Models.

Defines structured output format for workflow-aware agents.
Agents return AgentOutput which includes content and optional workflow_signal.
"""
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class WorkflowAction(str, Enum):
    """Actions an agent can signal to the workflow engine."""

    COMPLETE_STEP = "complete_step"  # Request to move to next step
    STAY = "stay"                     # Continue on current step
    NEED_INPUT = "need_input"         # Waiting for specific input (e.g., widget)


class WorkflowSignal(BaseModel):
    """
    Signal from agent to workflow engine.

    Agents include this in their response to indicate workflow state changes.
    """

    action: WorkflowAction = Field(
        default=WorkflowAction.STAY,
        description="The workflow action to take",
    )
    data: dict[str, Any] = Field(
        default_factory=dict,
        description="Data to store in workflow context",
    )
    reason: Optional[str] = Field(
        default=None,
        description="Optional explanation for the action",
    )


class AgentOutput(BaseModel):
    """
    Structured output from workflow-aware agents.

    This is the result_type for PydanticAI agents that participate in workflows.
    Contains the response content and optional workflow signal.
    """

    content: str = Field(
        description="The text response to show the user",
    )
    workflow_signal: Optional[WorkflowSignal] = Field(
        default=None,
        description="Optional signal to the workflow engine",
    )

    @classmethod
    def stay(cls, content: str, data: Optional[dict] = None) -> "AgentOutput":
        """Create a response that stays on current step."""
        return cls(
            content=content,
            workflow_signal=WorkflowSignal(
                action=WorkflowAction.STAY,
                data=data or {},
            ),
        )

    @classmethod
    def complete(
        cls,
        content: str,
        data: Optional[dict] = None,
        reason: Optional[str] = None,
    ) -> "AgentOutput":
        """Create a response that completes the current step."""
        return cls(
            content=content,
            workflow_signal=WorkflowSignal(
                action=WorkflowAction.COMPLETE_STEP,
                data=data or {},
                reason=reason,
            ),
        )

    @classmethod
    def need_input(
        cls,
        content: str,
        data: Optional[dict] = None,
    ) -> "AgentOutput":
        """Create a response that requests specific input."""
        return cls(
            content=content,
            workflow_signal=WorkflowSignal(
                action=WorkflowAction.NEED_INPUT,
                data=data or {},
            ),
        )
