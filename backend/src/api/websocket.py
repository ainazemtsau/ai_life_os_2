"""
WebSocket endpoint for real-time chat communication.
"""
import json
import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.services.connection_manager import manager
from src.services.conversation import conversation_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/chat")
async def websocket_chat(websocket: WebSocket):
    """
    WebSocket endpoint for chat communication.

    Incoming messages:
    - {"type": "message", "content": "...", "user_id": "..."}

    Outgoing messages:
    - {"type": "thinking"} - AI is processing
    - {"type": "ai_response", "content": "..."} - AI response
    - {"type": "error", "message": "..."} - Error occurred
    - {"type": "collection_created", "collection": {...}} - Collection created
    - {"type": "entity_created", "collection": "...", "entity": {...}} - Entity created
    - {"type": "entity_updated", "collection": "...", "entity": {...}} - Entity updated
    - {"type": "entity_deleted", "collection": "...", "entity_id": "..."} - Entity deleted
    """
    await manager.connect(websocket)

    try:
        while True:
            # Receive raw text message
            raw_data = await websocket.receive_text()

            # Try to parse JSON
            try:
                data = json.loads(raw_data)
            except json.JSONDecodeError:
                await manager.send_personal(websocket, {
                    "type": "error",
                    "message": "Invalid JSON format"
                })
                continue

            # Validate message structure
            msg_type = data.get("type")

            if msg_type == "message":
                content = data.get("content", "")
                user_id = data.get("user_id", str(uuid.uuid4()))

                if not content.strip():
                    await manager.send_personal(websocket, {
                        "type": "error",
                        "message": "Message content cannot be empty"
                    })
                    continue

                # Process with AI agent
                result = await conversation_service.process_message(
                    user_id=user_id,
                    message=content,
                    websocket=websocket,
                )

                if result.success:
                    await manager.send_personal(websocket, {
                        "type": "ai_response",
                        "content": result.response,
                    })
                else:
                    await manager.send_personal(websocket, {
                        "type": "error",
                        "message": result.error or "Unknown error occurred",
                    })

            else:
                await manager.send_personal(websocket, {
                    "type": "error",
                    "message": f"Unknown message type: {msg_type}"
                })

    except WebSocketDisconnect:
        manager.disconnect(websocket)
