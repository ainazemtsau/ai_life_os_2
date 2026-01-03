import logging
from typing import Any, Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections.

    Supports both anonymous connections and user-associated connections.
    User connections are tracked by user_id for targeted messaging from
    Temporal workflows.
    """

    def __init__(self):
        self.active_connections: list[WebSocket] = []
        # Map user_id -> list of WebSocket connections
        self.user_connections: dict[str, list[WebSocket]] = {}
        # Reverse map: WebSocket -> user_id
        self._websocket_users: dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and store a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("Client connected. Total connections: %d", len(self.active_connections))

    def register_user(self, user_id: str, websocket: WebSocket) -> None:
        """
        Associate a WebSocket connection with a user ID.

        This allows Temporal workflows to send messages to specific users.
        """
        # Remove from previous user if re-registering
        old_user_id = self._websocket_users.get(websocket)
        if old_user_id and old_user_id != user_id:
            self._remove_user_connection(old_user_id, websocket)

        # Add to new user
        if user_id not in self.user_connections:
            self.user_connections[user_id] = []

        if websocket not in self.user_connections[user_id]:
            self.user_connections[user_id].append(websocket)
            self._websocket_users[websocket] = user_id
            logger.debug("Registered websocket for user: %s", user_id)

    def _remove_user_connection(self, user_id: str, websocket: WebSocket) -> None:
        """Remove a WebSocket from user's connections."""
        if user_id in self.user_connections:
            if websocket in self.user_connections[user_id]:
                self.user_connections[user_id].remove(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

        # Clean up user association
        user_id = self._websocket_users.pop(websocket, None)
        if user_id:
            self._remove_user_connection(user_id, websocket)

        logger.info("Client disconnected. Total connections: %d", len(self.active_connections))

    async def send_personal(self, websocket: WebSocket, data: dict[str, Any]) -> None:
        """Send JSON data to a specific client."""
        try:
            await websocket.send_json(data)
        except Exception as e:
            logger.warning("Failed to send to websocket: %s", e)

    async def send_to_user(self, user_id: str, data: dict[str, Any]) -> bool:
        """
        Send JSON data to all connections for a specific user.

        Args:
            user_id: User ID to send to
            data: JSON-serializable data

        Returns:
            True if sent to at least one connection, False otherwise
        """
        connections = self.user_connections.get(user_id, [])

        if not connections:
            logger.debug("No active connections for user: %s", user_id)
            return False

        sent = False
        disconnected = []

        for websocket in connections:
            try:
                await websocket.send_json(data)
                sent = True
            except Exception as e:
                logger.warning("Failed to send to user %s: %s", user_id, e)
                disconnected.append(websocket)

        # Clean up disconnected websockets
        for ws in disconnected:
            self.disconnect(ws)

        return sent

    async def broadcast(self, data: dict[str, Any]) -> None:
        """Send JSON data to all connected clients."""
        disconnected = []

        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except Exception as e:
                logger.warning("Failed to broadcast: %s", e)
                disconnected.append(connection)

        # Clean up disconnected websockets
        for ws in disconnected:
            self.disconnect(ws)

    def get_user_connection_count(self, user_id: str) -> int:
        """Get number of active connections for a user."""
        return len(self.user_connections.get(user_id, []))

    def is_user_connected(self, user_id: str) -> bool:
        """Check if user has any active connections."""
        return user_id in self.user_connections and len(self.user_connections[user_id]) > 0


# Singleton instance
manager = ConnectionManager()
