"""
Database initialization for Pocketbase collections.

Creates required system collections if they don't exist.
"""
import logging
from typing import Optional

from src.services.pocketbase import pocketbase, PocketbaseError

logger = logging.getLogger(__name__)

# Collections required by the application
SYSTEM_COLLECTIONS = {
    "workflow_instances": {
        "name": "workflow_instances",
        "type": "base",
        "fields": [
            {"name": "user_id", "type": "text", "required": True},
            {"name": "workflow_name", "type": "text", "required": True},
            {"name": "current_step", "type": "text", "required": True},
            {
                "name": "status",
                "type": "select",
                "required": True,
                "options": {"values": ["active", "completed", "paused"]},
            },
            {"name": "context", "type": "json", "required": False},
            {"name": "started_at", "type": "date", "required": False},
            {"name": "completed_at", "type": "date", "required": False},
        ],
        "indexes": ["CREATE INDEX idx_workflow_user ON workflow_instances (user_id)"],
    },
    "inbox_items": {
        "name": "inbox_items",
        "type": "base",
        "fields": [
            {"name": "user_id", "type": "text", "required": True},
            {"name": "content", "type": "text", "required": True},
            {
                "name": "source",
                "type": "select",
                "required": True,
                "options": {"values": ["chat", "widget", "api"]},
            },
            {
                "name": "status",
                "type": "select",
                "required": True,
                "options": {"values": ["new", "processed", "archived"]},
            },
            {"name": "metadata", "type": "json", "required": False},
        ],
        "indexes": ["CREATE INDEX idx_inbox_user ON inbox_items (user_id)"],
    },
    "conversations": {
        "name": "conversations",
        "type": "base",
        "fields": [
            {"name": "user_id", "type": "text", "required": True},
            {"name": "workflow_instance_id", "type": "text", "required": False},
            {"name": "agent_name", "type": "text", "required": False},
            {
                "name": "status",
                "type": "select",
                "required": True,
                "options": {"values": ["active", "completed"]},
            },
        ],
        "indexes": ["CREATE INDEX idx_conv_user ON conversations (user_id)"],
    },
    "messages": {
        "name": "messages",
        "type": "base",
        "fields": [
            {"name": "conversation_id", "type": "text", "required": True},
            {
                "name": "role",
                "type": "select",
                "required": True,
                "options": {"values": ["user", "assistant", "system"]},
            },
            {"name": "content", "type": "text", "required": True},
            {"name": "agent_name", "type": "text", "required": False},
            {"name": "metadata", "type": "json", "required": False},
        ],
        "indexes": ["CREATE INDEX idx_msg_conv ON messages (conversation_id)"],
    },
    "widget_instances": {
        "name": "widget_instances",
        "type": "base",
        "fields": [
            {"name": "message_id", "type": "text", "required": True},
            {"name": "widget_type", "type": "text", "required": True},
            {"name": "config", "type": "json", "required": False},
            {
                "name": "status",
                "type": "select",
                "required": True,
                "options": {"values": ["pending", "active", "completed", "cancelled"]},
            },
            {"name": "data", "type": "json", "required": False},
            {"name": "completed_at", "type": "date", "required": False},
        ],
        "indexes": ["CREATE INDEX idx_widget_msg ON widget_instances (message_id)"],
    },
}


async def get_existing_collections() -> set[str]:
    """Get names of existing collections."""
    try:
        collections = await pocketbase.list_collections()
        return {col.get("name") for col in collections}
    except PocketbaseError as e:
        logger.error("Failed to list collections: %s", e.message)
        return set()


async def create_collection_if_not_exists(
    name: str,
    config: dict,
    existing: set[str],
) -> bool:
    """
    Create a collection if it doesn't exist.

    Returns True if created, False if already exists.
    """
    if name in existing:
        logger.debug("Collection '%s' already exists", name)
        return False

    try:
        await pocketbase.create_collection(name, config["fields"])
        logger.info("Created collection: %s", name)
        return True
    except PocketbaseError as e:
        logger.error("Failed to create collection '%s': %s", name, e.message)
        return False


async def init_database() -> tuple[int, int]:
    """
    Initialize all required database collections.

    Returns tuple of (created_count, existing_count).
    """
    logger.info("Initializing database collections...")

    existing = await get_existing_collections()
    created = 0
    skipped = 0

    for name, config in SYSTEM_COLLECTIONS.items():
        if await create_collection_if_not_exists(name, config, existing):
            created += 1
        else:
            skipped += 1

    logger.info(
        "Database initialization complete: %d created, %d already existed",
        created,
        skipped,
    )
    return created, skipped


async def check_database_ready() -> tuple[bool, str]:
    """
    Check if all required collections exist.

    Returns tuple of (success, message).
    """
    try:
        existing = await get_existing_collections()
        missing = set(SYSTEM_COLLECTIONS.keys()) - existing

        if missing:
            return False, f"Missing collections: {', '.join(missing)}"
        return True, "All required collections exist"
    except Exception as e:
        return False, f"Database check failed: {e}"
