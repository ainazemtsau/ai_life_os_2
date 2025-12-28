"""
Test endpoints for development and debugging.

These endpoints are temporary and should be removed or secured in production.
"""
import asyncio

from fastapi import APIRouter
from pydantic import BaseModel

from src.services.memory import MemoryService, check_memory_service
from src.services.conversation import conversation_service

router = APIRouter(prefix="/test", tags=["test"])


class MemoryTestResult(BaseModel):
    """Result of memory test."""

    success: bool
    add_result: list[dict] = []
    search_result: list[str] = []
    search_unrelated_result: list[str] = []
    get_all_result: list[str] = []
    error: str | None = None


class MemorySearchRequest(BaseModel):
    """Request for memory search."""

    query: str
    user_id: str = "test-user"
    limit: int = 5


class MemoryAddRequest(BaseModel):
    """Request for adding memory."""

    messages: list[dict]
    user_id: str = "test-user"


@router.get("/memory")
async def test_memory() -> MemoryTestResult:
    """
    Test Mem0 memory service with a complete flow.

    1. Creates MemoryService for test-user
    2. Adds test messages about workouts
    3. Waits for indexing
    4. Searches for "workouts" (should find)
    5. Searches for "shopping" (should not find)
    6. Gets all memories
    """
    try:
        # Create service
        service = MemoryService(user_id="test-user")

        if not service.is_available:
            return MemoryTestResult(
                success=False,
                error="Memory service not available"
            )

        # Add test messages
        messages = [
            {"role": "user", "content": "I want to track my workouts and fitness progress"},
            {"role": "assistant", "content": "I'll help you track your workouts. I've created a fitness tracking system for you."}
        ]
        add_result = await service.add(messages)

        # Wait for indexing (Mem0 processes async)
        await asyncio.sleep(2)

        # Search for related content
        search_result = await service.search("workouts", limit=5)

        # Search for unrelated content
        search_unrelated = await service.search("shopping groceries", limit=5)

        # Get all memories
        all_memories = await service.get_all(limit=10)

        return MemoryTestResult(
            success=True,
            add_result=add_result,
            search_result=search_result,
            search_unrelated_result=search_unrelated,
            get_all_result=all_memories,
        )
    except Exception as e:
        return MemoryTestResult(
            success=False,
            error=str(e)
        )


@router.get("/memory/status")
async def memory_status() -> dict:
    """Check memory service status."""
    ok, message = await check_memory_service()
    return {
        "available": ok,
        "message": message
    }


@router.post("/memory/add")
async def add_memory(request: MemoryAddRequest) -> dict:
    """
    Manually add messages to memory.

    Useful for testing custom messages.
    """
    try:
        service = MemoryService(user_id=request.user_id)
        if not service.is_available:
            return {"success": False, "error": "Memory service not available"}

        result = await service.add(request.messages)
        return {"success": True, "memories_added": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/memory/search")
async def search_memory(request: MemorySearchRequest) -> dict:
    """
    Search memories for a user.

    Useful for testing search queries.
    """
    try:
        service = MemoryService(user_id=request.user_id)
        if not service.is_available:
            return {"success": False, "error": "Memory service not available", "results": []}

        results = await service.search(request.query, limit=request.limit)
        return {"success": True, "results": results, "count": len(results)}
    except Exception as e:
        return {"success": False, "error": str(e), "results": []}


@router.get("/memory/all/{user_id}")
async def get_all_memories(user_id: str, limit: int = 20) -> dict:
    """
    Get all memories for a user.

    Useful for debugging what's stored.
    """
    try:
        service = MemoryService(user_id=user_id)
        if not service.is_available:
            return {"success": False, "error": "Memory service not available", "memories": []}

        memories = await service.get_all(limit=limit)
        return {"success": True, "memories": memories, "count": len(memories)}
    except Exception as e:
        return {"success": False, "error": str(e), "memories": []}


# ==================== AI Chat Test ====================


class AIChatRequest(BaseModel):
    """Request for AI chat."""

    user_id: str = "test-user"
    message: str


class AIChatResponse(BaseModel):
    """Response from AI chat."""

    success: bool
    response: str = ""
    error: str | None = None


@router.post("/ai/chat")
async def test_ai_chat(request: AIChatRequest) -> AIChatResponse:
    """
    Test AI chat without WebSocket.

    Useful for debugging AI responses via REST API.

    Example:
        curl -X POST http://localhost:8000/test/ai/chat \
            -H "Content-Type: application/json" \
            -d '{"user_id": "test", "message": "Привет"}'
    """
    result = await conversation_service.process_message(
        user_id=request.user_id,
        message=request.message,
        websocket=None,  # No WebSocket for REST test
    )

    return AIChatResponse(
        success=result.success,
        response=result.response,
        error=result.error,
    )
