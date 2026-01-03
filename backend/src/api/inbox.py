"""
Inbox API endpoints.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

from src.services.pocketbase import pocketbase, PocketbaseError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/inbox", tags=["inbox"])


class InboxItem(BaseModel):
    """Inbox item response."""

    id: str
    user_id: str
    content: str
    source: str
    status: str
    metadata: Optional[dict] = None
    created: Optional[str] = None


class InboxListResponse(BaseModel):
    """List of inbox items."""

    items: list[InboxItem]
    total: int


class CreateInboxItemRequest(BaseModel):
    """Request to create inbox item."""

    content: str
    source: str = "chat"
    metadata: Optional[dict] = None


@router.get("", response_model=InboxListResponse)
async def list_inbox(
    user_id: str = Query(..., description="User identifier"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200),
) -> InboxListResponse:
    """
    Get inbox items for user.

    Optionally filter by status (new, processed, archived).
    """
    try:
        filter_parts = [f'user_id="{user_id}"']
        if status:
            filter_parts.append(f'status="{status}"')

        result = await pocketbase.list_records(
            "inbox_items",
            filter=" && ".join(filter_parts),
            sort="-created",
            per_page=limit,
        )

        items = [
            InboxItem(
                id=item["id"],
                user_id=item["user_id"],
                content=item["content"],
                source=item["source"],
                status=item["status"],
                metadata=item.get("metadata"),
                created=item.get("created"),
            )
            for item in result.get("items", [])
        ]

        return InboxListResponse(
            items=items,
            total=result.get("totalItems", len(items)),
        )

    except PocketbaseError as e:
        logger.error("Failed to list inbox: %s", e.message)
        raise HTTPException(status_code=500, detail="Failed to load inbox")


@router.post("", response_model=InboxItem)
async def create_inbox_item(
    user_id: str = Query(..., description="User identifier"),
    request: CreateInboxItemRequest = ...,
) -> InboxItem:
    """Create a new inbox item."""
    try:
        record = await pocketbase.create_record(
            "inbox_items",
            {
                "user_id": user_id,
                "content": request.content,
                "source": request.source,
                "status": "new",
                "metadata": request.metadata or {},
            },
        )

        return InboxItem(
            id=record["id"],
            user_id=user_id,
            content=request.content,
            source=request.source,
            status="new",
            metadata=request.metadata,
            created=record.get("created"),
        )

    except PocketbaseError as e:
        logger.error("Failed to create inbox item: %s", e.message)
        raise HTTPException(status_code=500, detail="Failed to create inbox item")


@router.patch("/{item_id}/status")
async def update_inbox_status(
    item_id: str,
    status: str = Query(..., description="New status"),
) -> dict:
    """Update inbox item status."""
    if status not in ("new", "processed", "archived"):
        raise HTTPException(status_code=400, detail="Invalid status")

    try:
        await pocketbase.update_record(
            "inbox_items",
            item_id,
            {"status": status},
        )
        return {"success": True, "status": status}

    except PocketbaseError as e:
        logger.error("Failed to update inbox status: %s", e.message)
        raise HTTPException(status_code=500, detail="Failed to update status")


@router.delete("/{item_id}")
async def delete_inbox_item(item_id: str) -> dict:
    """Delete an inbox item."""
    try:
        await pocketbase.delete_record("inbox_items", item_id)
        return {"success": True}
    except PocketbaseError as e:
        logger.error("Failed to delete inbox item: %s", e.message)
        raise HTTPException(status_code=500, detail="Failed to delete item")
