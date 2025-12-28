# Module: backend — API

## Overview
FastAPI backend server providing REST and WebSocket endpoints for the AI Life OS application.

## Public Interface

### HTTP Endpoints

#### GET /health
Health check endpoint.

**Response:**
```json
{"status": "ok"}
```

#### POST /test/ai/chat
Test AI chat without WebSocket (for debugging).

**Request:**
```json
{
  "user_id": "test-user",
  "message": "Привет"
}
```

**Response:**
```json
{
  "success": true,
  "response": "Привет! Чем могу помочь?",
  "error": null
}
```

### WebSocket Endpoints

#### WS /chat
WebSocket endpoint for real-time chat communication.

**Connection:** `ws://localhost:8000/chat`

**Incoming Messages (from client):**
```json
{
  "type": "message",
  "content": "user text",
  "user_id": "optional-user-id"
}
```

**Outgoing Messages (to client):**
```json
// AI is processing
{
  "type": "thinking"
}

// AI response
{
  "type": "ai_response",
  "content": "AI response text"
}

// Error response
{
  "type": "error",
  "message": "error description"
}

// Collection created by AI
{
  "type": "collection_created",
  "collection": {
    "name": "tasks",
    "schema": [...]
  }
}

// Entity created by AI
{
  "type": "entity_created",
  "collection": "tasks",
  "entity": {
    "id": "abc123",
    "title": "Buy milk",
    "done": false
  }
}

// Entity updated by AI
{
  "type": "entity_updated",
  "collection": "tasks",
  "entity": {
    "id": "abc123",
    "title": "Buy milk",
    "done": true
  }
}

// Entity deleted by AI
{
  "type": "entity_deleted",
  "collection": "tasks",
  "entity_id": "abc123"
}
```

## Events / Messages

| Type | Direction | Description |
|------|-----------|-------------|
| `message` | Client → Server | User sends a message |
| `thinking` | Server → Client | AI is processing the message |
| `ai_response` | Server → Client | AI response text |
| `error` | Server → Client | Error occurred |
| `collection_created` | Server → Client | AI created a new collection |
| `entity_created` | Server → Client | AI created a new record |
| `entity_updated` | Server → Client | AI updated a record |
| `entity_deleted` | Server → Client | AI deleted a record |

---
Update this file when public interface changes.
