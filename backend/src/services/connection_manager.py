import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and store a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("Client connected. Total connections: %d", len(self.active_connections))

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info("Client disconnected. Total connections: %d", len(self.active_connections))

    async def send_personal(self, websocket: WebSocket, data: dict[str, Any]) -> None:
        """Send JSON data to a specific client."""
        await websocket.send_json(data)

    async def broadcast(self, data: dict[str, Any]) -> None:
        """Send JSON data to all connected clients."""
        for connection in self.active_connections:
            await connection.send_json(data)


# Singleton instance
manager = ConnectionManager()
