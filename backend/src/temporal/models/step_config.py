"""Step configuration model for workflows."""

from dataclasses import dataclass, field, asdict
from typing import Any, Optional


@dataclass(frozen=True)
class StepConfig:
    """
    Immutable configuration for a workflow step.

    Loaded from YAML configuration file.
    """

    name: str
    agent: str
    next_step: Optional[str]
    is_required: bool = True
    min_messages: int = 1
    max_messages: int = 20
    completion_criteria: dict[str, Any] = field(
        default_factory=lambda: {"type": "agent_signal"}
    )

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "StepConfig":
        """Create StepConfig from dictionary."""
        return cls(
            name=data["name"],
            agent=data["agent"],
            next_step=data.get("next_step"),
            is_required=data.get("is_required", True),
            min_messages=data.get("min_messages", 1),
            max_messages=data.get("max_messages", 20),
            completion_criteria=data.get(
                "completion_criteria", {"type": "agent_signal"}
            ),
        )
