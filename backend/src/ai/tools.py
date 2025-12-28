"""
Tools for AI Agent to interact with Pocketbase.

These tools allow the agent to:
- List/create collections
- Create/read/update/delete records
- Send WebSocket events on changes
"""
import logging
import re
from typing import Any, Optional

from pydantic_ai import RunContext

from src.ai.context import AgentDeps
from src.services.pocketbase import pocketbase, PocketbaseError
from src.services.connection_manager import manager

logger = logging.getLogger(__name__)

# System collections that should not be exposed to AI (our app's system collections)
APP_SYSTEM_COLLECTIONS = {"agents", "conversations", "users"}


def _normalize_collection_name(name: str) -> str:
    """
    Normalize collection name to valid Pocketbase format.

    - Lowercase
    - Replace spaces with underscores
    - Remove special characters
    - Ensure it starts with a letter
    """
    # Convert to lowercase and replace spaces
    normalized = name.lower().strip().replace(" ", "_")
    # Remove non-alphanumeric characters except underscores
    normalized = re.sub(r"[^a-z0-9_]", "", normalized)
    # Ensure it starts with a letter
    if normalized and not normalized[0].isalpha():
        normalized = "c_" + normalized
    return normalized or "collection"


def _field_type_to_pocketbase(field_type: str) -> dict:
    """
    Convert simple field type to Pocketbase schema format.

    Supported types:
    - text: plain text
    - number: numeric value
    - bool: boolean
    - select: select from options (options in field definition)
    - date: date/datetime
    - json: arbitrary JSON data
    """
    type_mapping = {
        "text": {"type": "text"},
        "number": {"type": "number"},
        "bool": {"type": "bool"},
        "select": {"type": "select"},
        "date": {"type": "date"},
        "json": {"type": "json"},
        "email": {"type": "email"},
        "url": {"type": "url"},
    }
    return type_mapping.get(field_type, {"type": "text"})


async def _send_ws_event(deps: AgentDeps, event_type: str, data: dict) -> None:
    """Send WebSocket event to connected client."""
    if deps.websocket:
        try:
            await manager.send_personal(
                deps.websocket,
                {"type": event_type, **data}
            )
        except Exception as e:
            logger.warning("Failed to send WS event: %s", e)


# ==================== Tools ====================


async def list_collections(ctx: RunContext[AgentDeps]) -> list[dict]:
    """
    List all user-created collections in Pocketbase.

    Returns a list of collections with their names and schemas.
    System collections are excluded.
    """
    try:
        all_collections = await pocketbase.list_collections()

        # Filter out system collections (Pocketbase internal + our app's system collections)
        user_collections = [
            {
                "name": col.get("name"),
                "fields": col.get("fields", col.get("schema", [])),
            }
            for col in all_collections
            if col.get("name") not in APP_SYSTEM_COLLECTIONS
            and not col.get("name", "").startswith("_")  # Exclude PB internal collections
        ]

        logger.info("Listed %d user collections", len(user_collections))
        return user_collections

    except PocketbaseError as e:
        logger.error("Failed to list collections: %s", e.message)
        return []


async def create_collection(
    ctx: RunContext[AgentDeps],
    name: str,
    fields: list[dict],
) -> dict:
    """
    Create a new collection in Pocketbase.

    Args:
        name: Collection name (will be normalized to lowercase, no spaces)
        fields: List of field definitions:
                [{"name": "title", "type": "text", "required": true},
                 {"name": "priority", "type": "select", "options": ["low", "medium", "high"]}]

    Returns:
        Created collection info or error
    """
    # === DIAGNOSTIC LOGGING ===
    logger.info("=" * 60)
    logger.info("CREATE_COLLECTION CALLED")
    logger.info("Raw arguments received:")
    logger.info("  name = %r (type: %s)", name, type(name).__name__)
    logger.info("  fields = %r (type: %s)", fields, type(fields).__name__)
    if fields:
        logger.info("  fields length = %d", len(fields))
        for i, f in enumerate(fields):
            logger.info("    field[%d] = %r", i, f)
    else:
        logger.info("  fields is EMPTY or None!")
    logger.info("=" * 60)
    # === END DIAGNOSTIC ===

    normalized_name = _normalize_collection_name(name)

    # Build Pocketbase schema
    schema = []
    for field in fields:
        field_name = field.get("name", "").lower().replace(" ", "_")
        field_type = field.get("type", "text")
        required = field.get("required", False)
        options = field.get("options", [])

        pb_field = {
            "name": field_name,
            "required": required,
            **_field_type_to_pocketbase(field_type),
        }

        # Add options for select type
        if field_type == "select" and options:
            pb_field["options"] = {"values": options}

        schema.append(pb_field)

    try:
        result = await pocketbase.create_collection(normalized_name, schema)
        logger.info("Created collection: %s", normalized_name)

        # Send WebSocket event
        await _send_ws_event(
            ctx.deps,
            "collection_created",
            {"collection": {"name": normalized_name, "schema": schema}}
        )

        return {
            "success": True,
            "name": normalized_name,
            "schema": schema,
        }

    except PocketbaseError as e:
        logger.error("Failed to create collection %s: %s", normalized_name, e.message)
        return {
            "success": False,
            "error": e.message,
        }


async def list_records(
    ctx: RunContext[AgentDeps],
    collection: str,
    filter: Optional[str] = None,
) -> list[dict]:
    """
    List records from a collection.

    Args:
        collection: Collection name
        filter: Optional Pocketbase filter expression

    Returns:
        List of records
    """
    try:
        result = await pocketbase.list_records(
            collection=collection,
            filter=filter,
            per_page=50,
        )

        items = result.get("items", [])
        logger.info("Listed %d records from %s", len(items), collection)
        return items

    except PocketbaseError as e:
        logger.error("Failed to list records from %s: %s", collection, e.message)
        return []


async def create_record(
    ctx: RunContext[AgentDeps],
    collection: str,
    data: dict,
) -> dict:
    """
    Create a new record in a collection.

    Args:
        collection: Collection name
        data: Record data as a dictionary

    Returns:
        Created record or error
    """
    # === DIAGNOSTIC LOGGING ===
    logger.info("=" * 60)
    logger.info("CREATE_RECORD CALLED")
    logger.info("Raw arguments received:")
    logger.info("  collection = %r", collection)
    logger.info("  data = %r (type: %s)", data, type(data).__name__)
    if data:
        for k, v in data.items():
            logger.info("    %s = %r", k, v)
    else:
        logger.info("  data is EMPTY!")
    logger.info("=" * 60)
    # === END DIAGNOSTIC ===

    try:
        result = await pocketbase.create_record(collection, data)
        logger.info("Created record in %s: %s", collection, result.get("id"))

        # Send WebSocket event
        await _send_ws_event(
            ctx.deps,
            "entity_created",
            {"collection": collection, "entity": result}
        )

        return {
            "success": True,
            "record": result,
        }

    except PocketbaseError as e:
        logger.error("Failed to create record in %s: %s", collection, e.message)
        return {
            "success": False,
            "error": e.message,
        }


async def update_record(
    ctx: RunContext[AgentDeps],
    collection: str,
    record_id: str,
    data: dict,
) -> dict:
    """
    Update an existing record in a collection.

    Args:
        collection: Collection name
        record_id: ID of the record to update
        data: Fields to update

    Returns:
        Updated record or error
    """
    try:
        result = await pocketbase.update_record(collection, record_id, data)
        logger.info("Updated record %s in %s", record_id, collection)

        # Send WebSocket event
        await _send_ws_event(
            ctx.deps,
            "entity_updated",
            {"collection": collection, "entity": result}
        )

        return {
            "success": True,
            "record": result,
        }

    except PocketbaseError as e:
        logger.error("Failed to update record %s in %s: %s", record_id, collection, e.message)
        return {
            "success": False,
            "error": e.message,
        }


async def delete_record(
    ctx: RunContext[AgentDeps],
    collection: str,
    record_id: str,
) -> dict:
    """
    Delete a record from a collection.

    Args:
        collection: Collection name
        record_id: ID of the record to delete

    Returns:
        Success status
    """
    try:
        await pocketbase.delete_record(collection, record_id)
        logger.info("Deleted record %s from %s", record_id, collection)

        # Send WebSocket event
        await _send_ws_event(
            ctx.deps,
            "entity_deleted",
            {"collection": collection, "entity_id": record_id}
        )

        return {
            "success": True,
            "deleted_id": record_id,
        }

    except PocketbaseError as e:
        logger.error("Failed to delete record %s from %s: %s", record_id, collection, e.message)
        return {
            "success": False,
            "error": e.message,
        }
