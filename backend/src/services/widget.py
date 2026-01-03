"""
Widget Service for managing interactive widgets.

Widgets are UI components that can be embedded in messages
to collect structured data from users.
"""
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

from src.services.pocketbase import pocketbase, PocketbaseError

logger = logging.getLogger(__name__)


@dataclass
class WidgetInstance:
    """Widget instance data."""

    id: str
    message_id: str
    widget_type: str
    config: dict = field(default_factory=dict)
    status: str = "pending"  # pending, active, completed, cancelled
    data: Optional[dict] = None
    completed_at: Optional[str] = None


class WidgetService:
    """
    Service for managing widget instances.

    Widgets allow agents to request structured input from users,
    such as lists, selections, confirmations, etc.
    """

    async def create_widget(
        self,
        message_id: str,
        widget_type: str,
        config: Optional[dict] = None,
    ) -> Optional[WidgetInstance]:
        """
        Create a new widget instance attached to a message.

        Args:
            message_id: ID of the message this widget belongs to
            widget_type: Type of widget (e.g., 'list_input', 'selection')
            config: Widget configuration

        Returns:
            WidgetInstance if created successfully
        """
        try:
            record = await pocketbase.create_record(
                "widget_instances",
                {
                    "message_id": message_id,
                    "widget_type": widget_type,
                    "config": config or {},
                    "status": "pending",
                },
            )
            widget = WidgetInstance(
                id=record["id"],
                message_id=message_id,
                widget_type=widget_type,
                config=config or {},
                status="pending",
            )
            logger.info(
                "Created widget %s (%s) for message %s",
                widget.id,
                widget_type,
                message_id,
            )
            return widget
        except PocketbaseError as e:
            logger.error("Failed to create widget: %s", e.message)
            return None

    async def get_widget(self, widget_id: str) -> Optional[WidgetInstance]:
        """Get widget instance by ID."""
        try:
            record = await pocketbase.get_record("widget_instances", widget_id)
            return WidgetInstance(
                id=record["id"],
                message_id=record["message_id"],
                widget_type=record["widget_type"],
                config=record.get("config", {}),
                status=record["status"],
                data=record.get("data"),
                completed_at=record.get("completed_at"),
            )
        except PocketbaseError as e:
            logger.error("Failed to get widget: %s", e.message)
            return None

    async def get_pending_widget(
        self,
        conversation_id: str,
    ) -> Optional[WidgetInstance]:
        """
        Get pending widget for a conversation.

        Returns the most recent pending or active widget.
        """
        try:
            # First get messages for the conversation
            messages_result = await pocketbase.list_records(
                "messages",
                filter=f'conversation_id="{conversation_id}"',
                sort="-created",
            )
            message_ids = [m["id"] for m in messages_result.get("items", [])]

            if not message_ids:
                return None

            # Build filter for widgets
            id_filters = " || ".join(f'message_id="{mid}"' for mid in message_ids[:50])
            widgets_result = await pocketbase.list_records(
                "widget_instances",
                filter=f'({id_filters}) && (status="pending" || status="active")',
                sort="-created",
            )

            items = widgets_result.get("items", [])
            if not items:
                return None

            record = items[0]
            return WidgetInstance(
                id=record["id"],
                message_id=record["message_id"],
                widget_type=record["widget_type"],
                config=record.get("config", {}),
                status=record["status"],
                data=record.get("data"),
            )
        except PocketbaseError as e:
            logger.error("Failed to get pending widget: %s", e.message)
            return None

    async def activate_widget(self, widget_id: str) -> bool:
        """Set widget status to active."""
        try:
            await pocketbase.update_record(
                "widget_instances",
                widget_id,
                {"status": "active"},
            )
            logger.info("Activated widget: %s", widget_id)
            return True
        except PocketbaseError as e:
            logger.error("Failed to activate widget: %s", e.message)
            return False

    async def complete_widget(
        self,
        widget_id: str,
        data: dict,
    ) -> bool:
        """
        Mark widget as completed with user-provided data.

        Args:
            widget_id: Widget instance ID
            data: Data collected from user

        Returns:
            True if successful
        """
        try:
            await pocketbase.update_record(
                "widget_instances",
                widget_id,
                {
                    "status": "completed",
                    "data": data,
                    "completed_at": datetime.utcnow().isoformat(),
                },
            )
            logger.info("Completed widget %s with data: %s", widget_id, data)
            return True
        except PocketbaseError as e:
            logger.error("Failed to complete widget: %s", e.message)
            return False

    async def cancel_widget(self, widget_id: str) -> bool:
        """Cancel a widget."""
        try:
            await pocketbase.update_record(
                "widget_instances",
                widget_id,
                {"status": "cancelled"},
            )
            logger.info("Cancelled widget: %s", widget_id)
            return True
        except PocketbaseError as e:
            logger.error("Failed to cancel widget: %s", e.message)
            return False

    async def get_widget_data(self, widget_id: str) -> Optional[dict]:
        """Get data from a completed widget."""
        widget = await self.get_widget(widget_id)
        if widget and widget.status == "completed":
            return widget.data
        return None

    async def list_widgets_for_message(
        self,
        message_id: str,
    ) -> list[WidgetInstance]:
        """Get all widgets attached to a message."""
        try:
            result = await pocketbase.list_records(
                "widget_instances",
                filter=f'message_id="{message_id}"',
                sort="created",
            )
            return [
                WidgetInstance(
                    id=record["id"],
                    message_id=record["message_id"],
                    widget_type=record["widget_type"],
                    config=record.get("config", {}),
                    status=record["status"],
                    data=record.get("data"),
                    completed_at=record.get("completed_at"),
                )
                for record in result.get("items", [])
            ]
        except PocketbaseError as e:
            logger.error("Failed to list widgets: %s", e.message)
            return []


# Singleton instance
widget_service = WidgetService()
