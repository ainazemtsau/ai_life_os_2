"""
Signal Activities.

Determine workflow signal after streaming response.
"""

import logging
from dataclasses import dataclass, field
from typing import Any

from temporalio import activity

logger = logging.getLogger(__name__)

# Prompt for determining workflow action
SIGNAL_DETERMINATION_PROMPT = """Analyze the conversation and determine the appropriate workflow action.

Current step: {current_step}
Step requirements: {step_requirements}

User message: {user_message}

Agent response: {agent_response}

Based on this exchange, determine:
1. Should we proceed to the next step (complete_step)?
2. Should we continue on the current step (stay)?

Rules:
- "complete_step" - user has satisfied the step's goals, confirmed understanding, or explicitly wants to proceed
- "stay" - more conversation needed, user hasn't confirmed, or there are follow-up questions

Respond with ONLY a JSON object:
{{"action": "complete_step" or "stay", "reason": "brief explanation"}}
"""


@dataclass
class GetSignalInput:
    """Input for signal determination activity."""

    agent_name: str
    user_message: str
    agent_response: str
    workflow_context: dict[str, Any] = field(default_factory=dict)


@dataclass
class SignalResult:
    """Result of signal determination."""

    signal: dict[str, Any]


@activity.defn
async def get_workflow_signal(input: GetSignalInput) -> SignalResult:
    """
    Determine workflow signal after streaming response.

    Makes a separate LLM call to analyze the conversation
    and decide whether to transition to next step or stay.

    Args:
        input: Conversation context

    Returns:
        SignalResult with workflow signal dict.
    """
    import json

    from pydantic_ai import Agent
    from src.config import settings

    logger.debug(
        "Determining workflow signal for agent '%s', step '%s'",
        input.agent_name,
        input.workflow_context.get("current_step", "unknown"),
    )

    current_step = input.workflow_context.get("current_step", "unknown")

    # Build step requirements description
    step_requirements = _get_step_requirements(current_step)

    prompt = SIGNAL_DETERMINATION_PROMPT.format(
        current_step=current_step,
        step_requirements=step_requirements,
        user_message=input.user_message,
        agent_response=input.agent_response,
    )

    try:
        # Use a fast model for signal determination
        agent = Agent(
            model=settings.get_llm_model(),
            system_prompt="You analyze conversations and return JSON.",
        )

        result = await agent.run(prompt)
        response_text = result.output

        # Parse JSON response
        signal = _parse_signal_response(response_text)

        logger.info(
            "Workflow signal determined: action=%s, reason=%s",
            signal.get("action", "stay"),
            signal.get("reason", ""),
        )

        return SignalResult(signal=signal)

    except Exception as e:
        logger.exception("Failed to determine workflow signal: %s", e)
        # Default to stay on error
        return SignalResult(
            signal={
                "action": "stay",
                "data": {},
                "reason": f"Signal determination failed: {str(e)}",
            }
        )


def _get_step_requirements(step: str) -> str:
    """Get requirements description for a step."""
    requirements = {
        "greeting": "User understood the system and is ready to proceed",
        "discovery": "Collected at least 3 priorities/life areas from user",
        "brain_dump": "User has shared thoughts/tasks for inbox",
        "setup_complete": "Finalize onboarding",
    }
    return requirements.get(step, "User confirmed completion")


def _parse_signal_response(response: str) -> dict[str, Any]:
    """Parse LLM response to extract signal."""
    import json
    import re

    # Try to extract JSON from response
    try:
        # Look for JSON object in response
        json_match = re.search(r'\{[^{}]*\}', response, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group())
            action = parsed.get("action", "stay")
            reason = parsed.get("reason", "")

            # Normalize action
            if action not in ("complete_step", "stay", "need_input"):
                action = "stay"

            return {
                "action": action,
                "data": {},
                "reason": reason,
            }
    except json.JSONDecodeError:
        pass

    # Check for keywords if JSON parsing fails
    response_lower = response.lower()
    if "complete_step" in response_lower or "proceed" in response_lower:
        return {"action": "complete_step", "data": {}, "reason": "Inferred from response"}

    return {"action": "stay", "data": {}, "reason": "Could not parse response"}
