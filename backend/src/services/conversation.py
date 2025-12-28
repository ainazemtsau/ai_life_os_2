"""
Conversation Service for processing user messages.

Orchestrates the AI agent execution with proper context loading,
memory management, and WebSocket event handling.
"""
import logging
from dataclasses import dataclass
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
class ConversationResult:
    """Result of processing a message."""

    response: str
    success: bool
    error: Optional[str] = None


class ConversationService:
    """
    Service for handling conversation with AI agent.

    Responsibilities:
    1. Load context (collections, memories) before agent call
    2. Execute AI agent with proper dependencies
    3. Save important information to Mem0
    4. Handle WebSocket events
    """

    async def process_message(
        self,
        user_id: str,
        message: str,
        websocket: Optional[WebSocket] = None,
    ) -> ConversationResult:
        """
        Process a user message and return AI response.

        Args:
            user_id: User identifier
            message: User's message text
            websocket: Optional WebSocket for sending events

        Returns:
            ConversationResult with response or error
        """
        try:
            # 1. Send "thinking" event
            if websocket:
                await manager.send_personal(websocket, {"type": "thinking"})

            # 2. Load context
            context = await self._load_context(user_id, message)

            # 3. Create agent dependencies
            deps = AgentDeps(
                user_id=user_id,
                websocket=websocket,
                context=context,
            )

            # 4. Run the agent
            logger.info("Running AI agent for user %s", user_id)
            result = await coordinator_agent.run(message, deps=deps)

            # Get response text from result
            response = result.output if hasattr(result, 'output') else str(result)
            logger.info("AI response: %s", response[:100] if len(response) > 100 else response)

            # 5. Save to memory (async, don't wait)
            await self._save_to_memory(user_id, message, response)

            return ConversationResult(
                response=response,
                success=True,
            )

        except Exception as e:
            logger.exception("Error processing message: %s", e)
            return ConversationResult(
                response="",
                success=False,
                error=str(e),
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
