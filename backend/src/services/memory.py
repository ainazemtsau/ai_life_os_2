"""
Mem0 Memory Service for long-term AI memory.

Provides a wrapper around Mem0 for storing and retrieving user memories
that persist across sessions.
"""
import logging
from typing import Optional

from mem0 import Memory

from src.config import settings

logger = logging.getLogger(__name__)


class MemoryServiceError(Exception):
    """Exception for memory service errors."""

    def __init__(self, message: str, original_error: Optional[Exception] = None):
        self.message = message
        self.original_error = original_error
        super().__init__(message)


class MemoryService:
    """
    Service for managing user memories using Mem0.

    Provides graceful degradation - if Mem0/Redis is unavailable,
    operations will log errors but not crash the application.
    """

    def __init__(self, user_id: str):
        """
        Initialize MemoryService for a specific user.

        Args:
            user_id: Unique identifier for the user
        """
        self.user_id = user_id
        self._memory: Optional[Memory] = None
        self._initialized = False
        self._init_error: Optional[str] = None

    def _ensure_initialized(self) -> bool:
        """
        Lazily initialize Mem0 connection.

        Returns:
            True if initialized successfully, False otherwise
        """
        if self._initialized:
            return self._memory is not None

        try:
            config = settings.get_mem0_config()
            self._memory = Memory.from_config(config)
            self._initialized = True
            logger.debug("Mem0 initialized for user %s", self.user_id)
            return True
        except Exception as e:
            self._init_error = str(e)
            self._initialized = True  # Mark as attempted
            logger.error("Failed to initialize Mem0: %s", e)
            return False

    async def add(self, messages: list[dict]) -> list[dict]:
        """
        Add messages to memory. Mem0 will extract important information.

        Args:
            messages: List of message dicts with 'role' and 'content' keys
                     Example: [{"role": "user", "content": "..."},
                              {"role": "assistant", "content": "..."}]

        Returns:
            List of extracted memories (for logging/debugging)
        """
        if not self._ensure_initialized():
            logger.warning("Memory service not available, skipping add")
            return []

        try:
            result = self._memory.add(messages, user_id=self.user_id)

            # Extract memories from result
            memories = []
            if isinstance(result, dict):
                # New format: {"results": [...]}
                memories = result.get("results", [])
            elif isinstance(result, list):
                memories = result

            if memories:
                logger.info(
                    "Added %d memories for user %s: %s",
                    len(memories),
                    self.user_id,
                    [m.get("memory", m) for m in memories[:3]],  # Log first 3
                )
            else:
                logger.debug("No new memories extracted from messages")

            return memories
        except Exception as e:
            logger.error("Failed to add memories: %s", e)
            return []

    async def search(self, query: str, limit: int = 5) -> list[str]:
        """
        Search for relevant memories.

        Args:
            query: Search query text
            limit: Maximum number of results to return

        Returns:
            List of memory strings, sorted by relevance
        """
        if not self._ensure_initialized():
            logger.warning("Memory service not available, returning empty results")
            return []

        try:
            results = self._memory.search(query, user_id=self.user_id, limit=limit)

            # Extract memory text from results
            memories = []
            if isinstance(results, dict):
                # New format: {"results": [...]}
                items = results.get("results", [])
            elif isinstance(results, list):
                items = results
            else:
                items = []

            for item in items:
                if isinstance(item, dict):
                    memory_text = item.get("memory", "")
                    if memory_text:
                        memories.append(memory_text)
                elif isinstance(item, str):
                    memories.append(item)

            logger.debug(
                "Search '%s' found %d memories for user %s",
                query[:50],
                len(memories),
                self.user_id,
            )
            return memories
        except Exception as e:
            logger.error("Failed to search memories: %s", e)
            return []

    async def get_all(self, limit: int = 20) -> list[str]:
        """
        Get all memories for the user.

        Args:
            limit: Maximum number of memories to return

        Returns:
            List of memory strings
        """
        if not self._ensure_initialized():
            logger.warning("Memory service not available, returning empty results")
            return []

        try:
            results = self._memory.get_all(user_id=self.user_id)

            # Extract memory text from results
            memories = []
            if isinstance(results, dict):
                items = results.get("results", [])
            elif isinstance(results, list):
                items = results
            else:
                items = []

            for item in items[:limit]:
                if isinstance(item, dict):
                    memory_text = item.get("memory", "")
                    if memory_text:
                        memories.append(memory_text)
                elif isinstance(item, str):
                    memories.append(item)

            logger.debug(
                "Retrieved %d memories for user %s",
                len(memories),
                self.user_id,
            )
            return memories
        except Exception as e:
            logger.error("Failed to get all memories: %s", e)
            return []

    @property
    def is_available(self) -> bool:
        """Check if memory service is available."""
        return self._ensure_initialized()


async def check_memory_service() -> tuple[bool, str]:
    """
    Check if memory service is working.

    Returns:
        Tuple of (success, message)
    """
    try:
        service = MemoryService(user_id="__health_check__")
        if service.is_available:
            return True, "Mem0 initialized successfully"
        else:
            return False, f"Mem0 initialization failed: {service._init_error}"
    except Exception as e:
        return False, f"Mem0 check failed: {e}"
