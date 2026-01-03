"""
Memory Activities.

Wraps Mem0 operations as Temporal activities.
"""
import logging
from dataclasses import dataclass, field
from typing import Any

from temporalio import activity

logger = logging.getLogger(__name__)


@dataclass
class MemorySearchInput:
    """Input for memory search activity."""

    user_id: str
    query: str
    limit: int = 5


@dataclass
class MemoryAddInput:
    """Input for memory add activity."""

    user_id: str
    messages: list[dict] = field(default_factory=list)


@activity.defn
async def search_memories(input: MemorySearchInput) -> list[str]:
    """
    Search Mem0 for relevant memories.

    Args:
        input: Search parameters

    Returns:
        List of relevant memory strings
    """
    from src.services.memory import MemoryService

    logger.debug(
        "Searching memories for user '%s' with query: %s",
        input.user_id,
        input.query[:50] if input.query else "",
    )

    try:
        memory_service = MemoryService(user_id=input.user_id)
        memories = await memory_service.search(query=input.query, limit=input.limit)

        logger.info(
            "Found %d memories for user '%s'",
            len(memories),
            input.user_id,
        )

        return memories

    except Exception as e:
        logger.error("Failed to search memories: %s", e)
        return []


@activity.defn
async def add_memory(input: MemoryAddInput) -> list[dict]:
    """
    Add conversation to Mem0.

    Args:
        input: Messages to add

    Returns:
        List of extracted memory dicts
    """
    from src.services.memory import MemoryService

    if not input.messages:
        logger.debug("No messages to add to memory")
        return []

    logger.debug(
        "Adding %d messages to memory for user '%s'",
        len(input.messages),
        input.user_id,
    )

    try:
        memory_service = MemoryService(user_id=input.user_id)
        result = await memory_service.add(messages=input.messages)

        logger.info(
            "Added %d memories for user '%s'",
            len(result) if result else 0,
            input.user_id,
        )

        return result

    except Exception as e:
        logger.error("Failed to add memories: %s", e)
        return []
