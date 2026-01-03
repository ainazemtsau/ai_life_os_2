"""
User API endpoints.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from src.services.memory import MemoryService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/user", tags=["user"])


class UserProfile(BaseModel):
    """User profile response."""

    user_id: str
    memories: list[str]
    memories_count: int


@router.get("/profile", response_model=UserProfile)
async def get_user_profile(
    user_id: str = Query(..., description="User identifier"),
) -> UserProfile:
    """
    Get user profile with memories.

    Returns user data and extracted memories from Mem0.
    """
    memories = []
    try:
        memory_service = MemoryService(user_id=user_id)
        if memory_service.is_available:
            memories = await memory_service.get_all(limit=50)
    except Exception as e:
        logger.warning("Failed to load memories for profile: %s", e)

    return UserProfile(
        user_id=user_id,
        memories=memories,
        memories_count=len(memories),
    )
