"""
WebSocket endpoint for real-time chat communication.
"""
import json
import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.services.connection_manager import manager
from src.services.conversation import conversation_service
from src.services.widget import widget_service

logger = logging.getLogger(__name__)

router = APIRouter()


async def send_message_new(websocket: WebSocket, content: str, role: str, agent_name: str = None, message_id: str = None):
    """Send message.new event to client."""
    await manager.send_personal(websocket, {
        "type": "message.new",
        "message": {
            "id": message_id,
            "role": role,
            "content": content,
            "agent_name": agent_name,
        }
    })


async def send_workflow_step_changed(websocket: WebSocket, workflow_id: str, step: str, agent: str = None):
    """Send workflow.step_changed event to client."""
    await manager.send_personal(websocket, {
        "type": "workflow.step_changed",
        "workflow_id": workflow_id,
        "step": step,
        "agent": agent,
    })


async def send_widget_show(websocket: WebSocket, widget_id: str, widget_type: str, config: dict):
    """Send widget.show event to client."""
    await manager.send_personal(websocket, {
        "type": "widget.show",
        "widget": {
            "id": widget_id,
            "type": widget_type,
            "config": config,
        }
    })


async def send_agent_changed(websocket: WebSocket, agent_name: str):
    """Send agent.changed event to client."""
    await manager.send_personal(websocket, {
        "type": "agent.changed",
        "agent": agent_name,
    })


@router.websocket("/chat")
async def websocket_chat(websocket: WebSocket):
    """
    WebSocket endpoint for chat communication.

    Incoming messages (from client):
    - {"type": "message.send", "content": "...", "user_id": "..."}
    - {"type": "message", "content": "...", "user_id": "..."} (legacy)
    - {"type": "widget.complete", "widget_id": "...", "data": {...}}
    - {"type": "widget.cancel", "widget_id": "..."}

    Outgoing messages (to client):
    - {"type": "thinking"} - AI is processing
    - {"type": "message.new", "message": {...}} - New message
    - {"type": "ai_response", "content": "..."} - AI response (legacy)
    - {"type": "error", "message": "..."} - Error occurred
    - {"type": "workflow.step_changed", "workflow_id": "...", "step": "...", "agent": "..."}
    - {"type": "widget.show", "widget": {...}}
    - {"type": "agent.changed", "agent": "..."}
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

            # Debug: log incoming message
            logger.info("Received message: type=%s, keys=%s", msg_type, list(data.keys()))

            # Handle message.send (new) and message (legacy)
            if msg_type in ("message.send", "message"):
                content = data.get("content", "")
                user_id = data.get("user_id", str(uuid.uuid4()))
                conversation_id = data.get("conversation_id")
                request_id = data.get("request_id")  # For streaming support

                # Debug: log message details
                logger.info(
                    "Processing message: user=%s, request_id=%s, content_len=%d",
                    user_id, request_id, len(content)
                )

                if not content.strip():
                    await manager.send_personal(websocket, {
                        "type": "error",
                        "message": "Message content cannot be empty"
                    })
                    continue

                # Process with Temporal workflow
                # If request_id is provided, streaming will be used
                # Otherwise, legacy notify_user activity delivers the response
                result = await conversation_service.process_message(
                    user_id=user_id,
                    message=content,
                    websocket=websocket,
                    conversation_id=conversation_id,
                    request_id=request_id,
                )

                # Only send error if processing failed
                # Success responses come via Temporal workflow -> notify activity
                if not result.success:
                    await manager.send_personal(websocket, {
                        "type": "error",
                        "message": result.error or "Unknown error occurred",
                    })

            # Handle widget.complete
            elif msg_type == "widget.complete":
                widget_id = data.get("widget_id")
                widget_data = data.get("data", {})

                if not widget_id:
                    await manager.send_personal(websocket, {
                        "type": "error",
                        "message": "widget_id is required"
                    })
                    continue

                success = await widget_service.complete_widget(widget_id, widget_data)

                await manager.send_personal(websocket, {
                    "type": "widget.completed" if success else "error",
                    "widget_id": widget_id,
                    "success": success,
                    "message": None if success else "Failed to complete widget",
                })

            # Handle widget.cancel
            elif msg_type == "widget.cancel":
                widget_id = data.get("widget_id")

                if not widget_id:
                    await manager.send_personal(websocket, {
                        "type": "error",
                        "message": "widget_id is required"
                    })
                    continue

                success = await widget_service.cancel_widget(widget_id)

                await manager.send_personal(websocket, {
                    "type": "widget.cancelled" if success else "error",
                    "widget_id": widget_id,
                    "success": success,
                    "message": None if success else "Failed to cancel widget",
                })

            else:
                await manager.send_personal(websocket, {
                    "type": "error",
                    "message": f"Unknown message type: {msg_type}"
                })

    except WebSocketDisconnect:
        manager.disconnect(websocket)
