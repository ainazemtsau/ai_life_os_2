"""
Notify Activity.

Sends WebSocket notifications from Temporal workflows.
"""
import logging
from dataclasses import dataclass, field
from typing import Any

from temporalio import activity

logger = logging.getLogger(__name__)


@dataclass
class NotifyInput:
    """Input for notify activity."""

    user_id: str
    event_type: str
    payload: dict = field(default_factory=dict)


@activity.defn
async def notify_user(input: NotifyInput) -> bool:
    """
    Send WebSocket event to user.

    Uses ConnectionManager to find user's WebSocket connection
    and send the event.

    Args:
        input: Notification parameters

    Returns:
        True if notification was sent, False otherwise
    """
    from src.services.connection_manager import manager

    logger.debug(
        "Notifying user '%s' with event '%s'",
        input.user_id,
        input.event_type,
    )

    try:
        # Build the message
        message = {
            "type": input.event_type,
            **input.payload,
        }

        # Try to send to user
        sent = await manager.send_to_user(input.user_id, message)

        if sent:
            logger.info(
                "Sent '%s' event to user '%s'",
                input.event_type,
                input.user_id,
            )
        else:
            logger.warning(
                "Could not send '%s' event to user '%s' - no active connection",
                input.event_type,
                input.user_id,
            )

        return sent

    except Exception as e:
        logger.error("Failed to notify user '%s': %s", input.user_id, e)
        return False
