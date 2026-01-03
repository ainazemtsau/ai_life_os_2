"""
Pocketbase Activities.

Wraps Pocketbase database operations as Temporal activities.
"""
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

from temporalio import activity

logger = logging.getLogger(__name__)


@dataclass
class CreateWorkflowInput:
    """Input for create workflow instance activity."""

    user_id: str
    workflow_name: str
    initial_step: str
    temporal_workflow_id: str


@dataclass
class UpdateStepInput:
    """Input for update workflow step activity."""

    instance_id: str
    new_step: str
    context_update: dict = field(default_factory=dict)


@dataclass
class SaveMessageInput:
    """Input for save message activity."""

    conversation_id: str
    role: str
    content: str
    agent_name: Optional[str] = None
    metadata: dict = field(default_factory=dict)


@activity.defn
async def create_workflow_instance(input: CreateWorkflowInput) -> str:
    """
    Create a new workflow instance in Pocketbase.

    Args:
        input: Workflow instance parameters

    Returns:
        Instance ID (Pocketbase record ID)
    """
    from src.services.pocketbase import pocketbase

    logger.info(
        "Creating workflow instance '%s' for user '%s'",
        input.workflow_name,
        input.user_id,
    )

    try:
        record = await pocketbase.create_record(
            "workflow_instances",
            {
                "user_id": input.user_id,
                "workflow_name": input.workflow_name,
                "current_step": input.initial_step,
                "status": "active",
                "context": {},
                "started_at": datetime.utcnow().isoformat(),
                "temporal_workflow_id": input.temporal_workflow_id,
            },
        )

        instance_id = record.get("id", "")
        logger.info("Created workflow instance: %s", instance_id)

        return instance_id

    except Exception as e:
        logger.error("Failed to create workflow instance: %s", e)
        raise


@activity.defn
async def update_workflow_step(input: UpdateStepInput) -> bool:
    """
    Update workflow step in Pocketbase.

    Args:
        input: Update parameters

    Returns:
        True if updated successfully
    """
    from src.services.pocketbase import pocketbase

    logger.info(
        "Updating workflow instance '%s' to step '%s'",
        input.instance_id,
        input.new_step,
    )

    try:
        # Get current record to merge context
        current = await pocketbase.get_record("workflow_instances", input.instance_id)
        current_context = current.get("context", {})

        # Merge context updates
        merged_context = {**current_context, **input.context_update}

        # Update record
        await pocketbase.update_record(
            "workflow_instances",
            input.instance_id,
            {
                "current_step": input.new_step,
                "context": merged_context,
            },
        )

        logger.info("Updated workflow instance '%s' to step '%s'", input.instance_id, input.new_step)
        return True

    except Exception as e:
        logger.error("Failed to update workflow step: %s", e)
        return False


@activity.defn
async def complete_workflow(instance_id: str) -> bool:
    """
    Mark workflow as completed in Pocketbase.

    Args:
        instance_id: Workflow instance ID

    Returns:
        True if updated successfully
    """
    from src.services.pocketbase import pocketbase

    logger.info("Completing workflow instance '%s'", instance_id)

    try:
        await pocketbase.update_record(
            "workflow_instances",
            instance_id,
            {
                "status": "completed",
                "completed_at": datetime.utcnow().isoformat(),
            },
        )

        logger.info("Completed workflow instance '%s'", instance_id)
        return True

    except Exception as e:
        logger.error("Failed to complete workflow: %s", e)
        return False


@activity.defn
async def save_message(input: SaveMessageInput) -> str:
    """
    Save a message to conversation history.

    Args:
        input: Message parameters

    Returns:
        Message ID (Pocketbase record ID)
    """
    from src.services.pocketbase import pocketbase

    logger.debug(
        "Saving %s message to conversation '%s'",
        input.role,
        input.conversation_id,
    )

    try:
        record = await pocketbase.create_record(
            "messages",
            {
                "conversation_id": input.conversation_id,
                "role": input.role,
                "content": input.content,
                "agent_name": input.agent_name,
                "metadata": input.metadata,
            },
        )

        message_id = record.get("id", "")
        logger.debug("Saved message: %s", message_id)

        return message_id

    except Exception as e:
        logger.error("Failed to save message: %s", e)
        raise


@activity.defn
async def get_user_collections(user_id: str) -> list[dict]:
    """
    Get user's collections from Pocketbase.

    Args:
        user_id: User ID

    Returns:
        List of collection metadata dicts
    """
    from src.services.pocketbase import pocketbase

    logger.debug("Getting collections for user '%s'", user_id)

    try:
        # Get all collections (Pocketbase doesn't have per-user collections)
        collections = await pocketbase.list_collections()

        # Filter out system collections
        system_collections = {"users", "agents", "conversations", "messages", "workflow_instances", "widget_instances"}
        user_collections = [
            c for c in collections
            if c.get("name") not in system_collections
        ]

        logger.debug("Found %d user collections", len(user_collections))
        return user_collections

    except Exception as e:
        logger.error("Failed to get collections: %s", e)
        return []


@activity.defn
async def get_or_create_conversation(user_id: str, workflow_instance_id: str) -> str:
    """
    Get active conversation or create new one.

    Args:
        user_id: User ID
        workflow_instance_id: Workflow instance ID

    Returns:
        Conversation ID
    """
    from src.services.pocketbase import pocketbase

    logger.debug(
        "Getting/creating conversation for user '%s', workflow '%s'",
        user_id,
        workflow_instance_id,
    )

    try:
        # Try to find active conversation
        result = await pocketbase.list_records(
            "conversations",
            filter=f'user_id="{user_id}" && status="active"',
        )
        records = result.get("items", [])

        if records:
            conversation_id = records[0].get("id", "")
            logger.debug("Found existing conversation: %s", conversation_id)
            return conversation_id

        # Create new conversation
        record = await pocketbase.create_record(
            "conversations",
            {
                "user_id": user_id,
                "workflow_instance_id": workflow_instance_id,
                "status": "active",
            },
        )

        conversation_id = record.get("id", "")
        logger.info("Created new conversation: %s", conversation_id)
        return conversation_id

    except Exception as e:
        logger.error("Failed to get/create conversation: %s", e)
        raise
