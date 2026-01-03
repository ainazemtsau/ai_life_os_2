"""
Conversations API endpoints.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

from src.services.conversation import conversation_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/conversations", tags=["conversations"])


class ConversationResponse(BaseModel):
    """Conversation response."""

    id: str
    user_id: str
    workflow_instance_id: Optional[str] = None
    agent_name: Optional[str] = None
    status: str


class MessageResponse(BaseModel):
    """Message response."""

    id: str
    conversation_id: str
    role: str
    content: str
    agent_name: Optional[str] = None
    metadata: Optional[dict] = None


class ConversationWithHistory(BaseModel):
    """Conversation with message history."""

    conversation: ConversationResponse
    messages: list[MessageResponse]


@router.get("/active", response_model=Optional[ConversationResponse])
async def get_active_conversation(
    user_id: str = Query(..., description="User identifier"),
) -> Optional[ConversationResponse]:
    """Get active conversation for user."""
    conversation = await conversation_service.get_active_conversation(user_id)

    if not conversation:
        return None

    return ConversationResponse(
        id=conversation.id,
        user_id=conversation.user_id,
        workflow_instance_id=conversation.workflow_instance_id,
        agent_name=conversation.agent_name,
        status=conversation.status,
    )


@router.get("/{conversation_id}", response_model=ConversationWithHistory)
async def get_conversation_with_history(
    conversation_id: str,
    limit: int = Query(50, ge=1, le=200),
) -> ConversationWithHistory:
    """Get conversation with message history."""
    # Get messages
    messages = await conversation_service.get_history(conversation_id, limit)

    if not messages:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Build response
    return ConversationWithHistory(
        conversation=ConversationResponse(
            id=conversation_id,
            user_id="",  # Would need to fetch from first message or conversation record
            status="active",
        ),
        messages=[
            MessageResponse(
                id=msg.id,
                conversation_id=msg.conversation_id,
                role=msg.role,
                content=msg.content,
                agent_name=msg.agent_name,
                metadata=msg.metadata,
            )
            for msg in messages
        ],
    )


@router.post("/{conversation_id}/complete")
async def complete_conversation(conversation_id: str) -> dict:
    """Mark conversation as completed."""
    success = await conversation_service.complete_conversation(conversation_id)

    if not success:
        raise HTTPException(
            status_code=500,
            detail="Failed to complete conversation",
        )

    return {"success": True}
