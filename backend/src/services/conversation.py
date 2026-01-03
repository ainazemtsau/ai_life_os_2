"""
Conversation Service for processing user messages.

Orchestrates message handling via Temporal workflows.
Messages are sent as signals to the workflow, and responses
are delivered via WebSocket through notify activities.
"""
import logging
from dataclasses import dataclass, field
from typing import Optional

from fastapi import WebSocket
from temporalio.client import WorkflowHandle
from temporalio.service import RPCError

from src.services.pocketbase import pocketbase, PocketbaseError
from src.services.connection_manager import manager
from src.temporal.client import get_temporal_client
from src.temporal.worker import TASK_QUEUE
from src.temporal.workflows.onboarding import OnboardingWorkflow, UserMessage

logger = logging.getLogger(__name__)

# Default workflow for new users
DEFAULT_WORKFLOW = "onboarding"


@dataclass
class ConversationData:
    """Conversation data from database."""

    id: str
    user_id: str
    workflow_instance_id: Optional[str] = None
    agent_name: Optional[str] = None
    status: str = "active"


@dataclass
class MessageData:
    """Message data from database."""

    id: str
    conversation_id: str
    role: str  # user, assistant, system
    content: str
    agent_name: Optional[str] = None
    metadata: dict = field(default_factory=dict)


@dataclass
class ConversationResult:
    """Result of processing a message."""

    response: str
    success: bool
    error: Optional[str] = None
    conversation_id: Optional[str] = None
    message_id: Optional[str] = None


class ConversationService:
    """
    Service for handling conversation with AI agent.

    Responsibilities:
    1. Create and manage conversations in database
    2. Load context (collections, memories) before agent call
    3. Execute AI agent with proper dependencies
    4. Save messages to database
    5. Save important information to Mem0
    6. Handle WebSocket events
    """

    async def create_conversation(
        self,
        user_id: str,
        agent_name: Optional[str] = None,
        workflow_instance_id: Optional[str] = None,
    ) -> Optional[ConversationData]:
        """Create a new conversation."""
        try:
            record = await pocketbase.create_record(
                "conversations",
                {
                    "user_id": user_id,
                    "agent_name": agent_name,
                    "workflow_instance_id": workflow_instance_id,
                    "status": "active",
                },
            )
            return ConversationData(
                id=record["id"],
                user_id=user_id,
                agent_name=agent_name,
                workflow_instance_id=workflow_instance_id,
                status="active",
            )
        except PocketbaseError as e:
            logger.error("Failed to create conversation: %s", e.message)
            return None

    async def get_active_conversation(
        self,
        user_id: str,
    ) -> Optional[ConversationData]:
        """Get active conversation for a user."""
        try:
            result = await pocketbase.list_records(
                "conversations",
                filter=f'user_id="{user_id}" && status="active"',
                sort="-created",
            )
            items = result.get("items", [])
            if not items:
                return None

            record = items[0]
            return ConversationData(
                id=record["id"],
                user_id=record["user_id"],
                agent_name=record.get("agent_name"),
                workflow_instance_id=record.get("workflow_instance_id"),
                status=record["status"],
            )
        except PocketbaseError as e:
            logger.error("Failed to get active conversation: %s", e.message)
            return None

    async def get_or_create_conversation(
        self,
        user_id: str,
        agent_name: Optional[str] = None,
    ) -> Optional[ConversationData]:
        """Get active conversation or create new one."""
        conversation = await self.get_active_conversation(user_id)
        if conversation:
            return conversation
        return await self.create_conversation(user_id, agent_name)

    async def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        agent_name: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> Optional[MessageData]:
        """Add a message to conversation."""
        try:
            record = await pocketbase.create_record(
                "messages",
                {
                    "conversation_id": conversation_id,
                    "role": role,
                    "content": content,
                    "agent_name": agent_name,
                    "metadata": metadata or {},
                },
            )
            return MessageData(
                id=record["id"],
                conversation_id=conversation_id,
                role=role,
                content=content,
                agent_name=agent_name,
                metadata=metadata or {},
            )
        except PocketbaseError as e:
            logger.error("Failed to add message: %s", e.message)
            return None

    async def get_history(
        self,
        conversation_id: str,
        limit: int = 50,
    ) -> list[MessageData]:
        """Get conversation message history."""
        try:
            result = await pocketbase.list_records(
                "messages",
                filter=f'conversation_id="{conversation_id}"',
                sort="created",
                per_page=limit,
            )
            return [
                MessageData(
                    id=record["id"],
                    conversation_id=record["conversation_id"],
                    role=record["role"],
                    content=record["content"],
                    agent_name=record.get("agent_name"),
                    metadata=record.get("metadata", {}),
                )
                for record in result.get("items", [])
            ]
        except PocketbaseError as e:
            logger.error("Failed to get history: %s", e.message)
            return []

    async def complete_conversation(self, conversation_id: str) -> bool:
        """Mark conversation as completed."""
        try:
            await pocketbase.update_record(
                "conversations",
                conversation_id,
                {"status": "completed"},
            )
            return True
        except PocketbaseError as e:
            logger.error("Failed to complete conversation: %s", e.message)
            return False

    async def process_message(
        self,
        user_id: str,
        message: str,
        websocket: Optional[WebSocket] = None,
        conversation_id: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> ConversationResult:
        """
        Process a user message via Temporal workflow.

        This method:
        1. Registers the WebSocket connection for the user
        2. Gets or starts a Temporal workflow
        3. Sends the message as a signal to the workflow
        4. Response is delivered via notify activity through WebSocket

        Note: The actual AI response is delivered asynchronously via WebSocket,
        so this method returns immediately after sending the signal.

        Args:
            user_id: User identifier
            message: User's message text
            websocket: Optional WebSocket for sending events
            conversation_id: Optional existing conversation ID

        Returns:
            ConversationResult indicating signal was sent
        """
        try:
            # 1. Register WebSocket for user (for notify activity)
            if websocket:
                manager.register_user(user_id, websocket)
                # Send "thinking" event immediately
                await manager.send_personal(websocket, {"type": "thinking"})

            # 2. Get Temporal client
            client = await get_temporal_client()

            # 3. Build workflow ID for this user
            workflow_id = f"onboarding-{user_id}"

            # 4. Try to get existing workflow or start new one
            handle: Optional[WorkflowHandle] = None

            try:
                # Try to get existing workflow
                handle = client.get_workflow_handle(workflow_id)
                # Verify it exists by querying state
                await handle.query(OnboardingWorkflow.get_state)
                logger.debug("Found existing workflow for user: %s", user_id)

            except RPCError as e:
                # Workflow doesn't exist, start new one
                logger.info("Starting new onboarding workflow for user: %s", user_id)
                handle = await client.start_workflow(
                    OnboardingWorkflow.run,
                    args=[user_id, {}],
                    id=workflow_id,
                    task_queue=TASK_QUEUE,
                )
                logger.info("Started workflow: %s", workflow_id)

            except Exception as e:
                # Other error - try to start anyway
                logger.warning("Error checking workflow, starting new: %s", e)
                try:
                    handle = await client.start_workflow(
                        OnboardingWorkflow.run,
                        args=[user_id, {}],
                        id=workflow_id,
                        task_queue=TASK_QUEUE,
                    )
                except Exception as start_error:
                    # Workflow might already exist, try to get handle
                    logger.debug("Workflow may already exist: %s", start_error)
                    handle = client.get_workflow_handle(workflow_id)

            # 5. Send user message signal to workflow
            # Wrap in try-catch to handle terminated/completed workflows
            try:
                await handle.signal(
                    OnboardingWorkflow.user_message,
                    UserMessage(
                        content=message,
                        conversation_id=conversation_id,
                        request_id=request_id,
                    ),
                )
                logger.info(
                    "Sent message signal to workflow: %s (request_id=%s)",
                    workflow_id,
                    request_id,
                )
            except RPCError as signal_error:
                # Workflow might be completed/terminated, start a new one
                if "already completed" in str(signal_error):
                    logger.info(
                        "Workflow %s completed, starting new one",
                        workflow_id,
                    )
                    handle = await client.start_workflow(
                        OnboardingWorkflow.run,
                        args=[user_id, {}],
                        id=workflow_id,
                        task_queue=TASK_QUEUE,
                    )
                    # Signal the new workflow
                    await handle.signal(
                        OnboardingWorkflow.user_message,
                        UserMessage(
                            content=message,
                            conversation_id=conversation_id,
                            request_id=request_id,
                        ),
                    )
                    logger.info(
                        "Sent message signal to new workflow: %s (request_id=%s)",
                        workflow_id,
                        request_id,
                    )
                else:
                    raise

            # Response will be delivered via notify activity through WebSocket
            # Return success immediately
            return ConversationResult(
                response="",  # Response comes via WebSocket
                success=True,
                conversation_id=conversation_id,
            )

        except Exception as e:
            logger.exception("Error processing message: %s", e)

            # Try to send error via WebSocket
            if websocket:
                try:
                    await manager.send_personal(websocket, {
                        "type": "error",
                        "message": f"Failed to process message: {str(e)}",
                    })
                except:
                    pass

            return ConversationResult(
                response="",
                success=False,
                error=str(e),
                conversation_id=conversation_id,
            )

    # Note: Context loading, memory saving, and WebSocket events
    # are now handled by Temporal activities in the workflow.
    # - Agent context: handled by run_workflow_agent activity
    # - Memory: handled by search_memories and add_memory activities
    # - WebSocket events: handled by notify_user activity


# Singleton instance
conversation_service = ConversationService()
