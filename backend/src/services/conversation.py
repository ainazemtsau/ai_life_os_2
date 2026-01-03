"""
Conversation Service for processing user messages.

Orchestrates the AI agent execution with proper context loading,
memory management, and WebSocket event handling.
"""
import logging
from dataclasses import dataclass, field
from typing import Optional

from fastapi import WebSocket

from src.ai.agent import coordinator_agent
from src.ai.context import AgentContext, AgentDeps
from src.ai.tools import APP_SYSTEM_COLLECTIONS
from src.services.pocketbase import pocketbase, PocketbaseError
from src.services.memory import MemoryService
from src.services.connection_manager import manager

logger = logging.getLogger(__name__)


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
    ) -> ConversationResult:
        """
        Process a user message and return AI response.

        Args:
            user_id: User identifier
            message: User's message text
            websocket: Optional WebSocket for sending events
            conversation_id: Optional existing conversation ID

        Returns:
            ConversationResult with response or error
        """
        conv_id = conversation_id
        user_msg_id = None
        assistant_msg_id = None

        try:
            # 1. Send "thinking" event
            if websocket:
                await manager.send_personal(websocket, {"type": "thinking"})

            # 2. Get or create conversation
            if not conv_id:
                conversation = await self.get_or_create_conversation(user_id)
                if conversation:
                    conv_id = conversation.id

            # 3. Save user message to DB
            if conv_id:
                user_msg = await self.add_message(conv_id, "user", message)
                if user_msg:
                    user_msg_id = user_msg.id

            # 4. Load context
            context = await self._load_context(user_id, message)

            # 5. Create agent dependencies
            deps = AgentDeps(
                user_id=user_id,
                websocket=websocket,
                context=context,
            )

            # 6. Run the agent
            logger.info("Running AI agent for user %s", user_id)
            result = await coordinator_agent.run(message, deps=deps)

            # Get response text from result
            response = result.output if hasattr(result, 'output') else str(result)
            logger.info("AI response: %s", response[:100] if len(response) > 100 else response)

            # 7. Save assistant message to DB
            if conv_id:
                assistant_msg = await self.add_message(
                    conv_id,
                    "assistant",
                    response,
                    agent_name="coordinator",
                )
                if assistant_msg:
                    assistant_msg_id = assistant_msg.id

            # 8. Save to memory (async, don't wait)
            await self._save_to_memory(user_id, message, response)

            return ConversationResult(
                response=response,
                success=True,
                conversation_id=conv_id,
                message_id=assistant_msg_id,
            )

        except Exception as e:
            logger.exception("Error processing message: %s", e)
            return ConversationResult(
                response="",
                success=False,
                error=str(e),
                conversation_id=conv_id,
            )

    async def _load_context(self, user_id: str, message: str) -> AgentContext:
        """
        Load context for the agent.

        Fetches:
        - Existing collections from Pocketbase
        - Relevant memories from Mem0
        """
        context = AgentContext(user_id=user_id)

        # Load collections
        try:
            all_collections = await pocketbase.list_collections()
            context.collections = [
                {
                    "name": col.get("name"),
                    "fields": col.get("fields", col.get("schema", [])),
                }
                for col in all_collections
                if col.get("name") not in APP_SYSTEM_COLLECTIONS
                and not col.get("name", "").startswith("_")  # Exclude PB internal collections
            ]
            logger.debug("Loaded %d collections", len(context.collections))
        except PocketbaseError as e:
            logger.warning("Failed to load collections: %s", e.message)

        # Load memories
        try:
            memory_service = MemoryService(user_id=user_id)
            if memory_service.is_available:
                memories = await memory_service.search(message, limit=5)
                context.memories = memories
                logger.debug("Loaded %d relevant memories", len(memories))
        except Exception as e:
            logger.warning("Failed to load memories: %s", e)

        return context

    async def _save_to_memory(
        self,
        user_id: str,
        user_message: str,
        assistant_response: str,
    ) -> None:
        """
        Save conversation to Mem0 for future context.

        Mem0 will extract important information from the conversation.
        """
        try:
            memory_service = MemoryService(user_id=user_id)
            if memory_service.is_available:
                messages = [
                    {"role": "user", "content": user_message},
                    {"role": "assistant", "content": assistant_response},
                ]
                await memory_service.add(messages)
                logger.debug("Saved conversation to memory")
        except Exception as e:
            logger.warning("Failed to save to memory: %s", e)


# Singleton instance
conversation_service = ConversationService()
