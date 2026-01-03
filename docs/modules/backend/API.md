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

#### GET /api/user/profile
Get user profile with memories.

**Query Parameters:**
- `user_id` (required): User identifier

**Response:**
```json
{
  "user_id": "user-123",
  "memories": ["fact 1", "fact 2"],
  "memories_count": 2
}
```

#### GET /api/workflow/current
Get current active workflow for user.

**Query Parameters:**
- `user_id` (required): User identifier

**Response:**
```json
{
  "instance": {
    "id": "wf-123",
    "user_id": "user-123",
    "workflow_name": "onboarding",
    "current_step": "greeting",
    "status": "active",
    "context": {},
    "started_at": "2024-01-01T00:00:00"
  },
  "current_step": {
    "name": "greeting",
    "agent": "greeter",
    "is_required": true,
    "next_step": "discovery"
  }
}
```

#### POST /api/workflow/start
Start a new workflow.

**Query Parameters:**
- `user_id` (required): User identifier

**Request:**
```json
{
  "workflow_name": "onboarding",
  "initial_context": {}
}
```

#### POST /api/workflow/{instance_id}/transition
Transition workflow to next step.

**Request:**
```json
{
  "to_step": "discovery",
  "data": {}
}
```

#### GET /api/workflow/list
List available workflow types.

#### GET /api/inbox
Get inbox items for user.

**Query Parameters:**
- `user_id` (required): User identifier
- `status` (optional): Filter by status (new, processed, archived)
- `limit` (optional): Max items to return (default: 50)

**Response:**
```json
{
  "items": [
    {
      "id": "item-123",
      "user_id": "user-123",
      "content": "Task text",
      "source": "chat",
      "status": "new",
      "metadata": {},
      "created": "2024-01-01T00:00:00"
    }
  ],
  "total": 1
}
```

#### POST /api/inbox
Create new inbox item.

**Query Parameters:**
- `user_id` (required): User identifier

**Request:**
```json
{
  "content": "New task",
  "source": "chat",
  "metadata": {}
}
```

#### PATCH /api/inbox/{item_id}/status
Update inbox item status.

**Query Parameters:**
- `status` (required): new | processed | archived

#### DELETE /api/inbox/{item_id}
Delete inbox item.

#### GET /api/conversations/active
Get active conversation for user.

**Query Parameters:**
- `user_id` (required): User identifier

**Response:**
```json
{
  "id": "conv-123",
  "user_id": "user-123",
  "workflow_instance_id": "wf-123",
  "agent_name": "coordinator",
  "status": "active"
}
```

#### GET /api/conversations/{conversation_id}
Get conversation with message history.

**Query Parameters:**
- `limit` (optional): Max messages (default: 50)

**Response:**
```json
{
  "conversation": {
    "id": "conv-123",
    "user_id": "user-123",
    "status": "active"
  },
  "messages": [
    {
      "id": "msg-1",
      "conversation_id": "conv-123",
      "role": "user",
      "content": "Hello",
      "agent_name": null
    },
    {
      "id": "msg-2",
      "conversation_id": "conv-123",
      "role": "assistant",
      "content": "Hi there!",
      "agent_name": "coordinator"
    }
  ]
}
```

#### POST /api/conversations/{conversation_id}/complete
Mark conversation as completed.

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
// Send message (new format)
{
  "type": "message.send",
  "content": "user text",
  "user_id": "user-123",
  "conversation_id": "conv-123"
}

// Send message (legacy format)
{
  "type": "message",
  "content": "user text",
  "user_id": "user-123"
}

// Complete widget
{
  "type": "widget.complete",
  "widget_id": "widget-123",
  "data": {"items": ["item1", "item2"]}
}

// Cancel widget
{
  "type": "widget.cancel",
  "widget_id": "widget-123"
}
```

**Outgoing Messages (to client):**
```json
// AI is processing
{
  "type": "thinking"
}

// New message (new format)
{
  "type": "message.new",
  "message": {
    "id": "msg-123",
    "role": "assistant",
    "content": "AI response text",
    "agent_name": "coordinator"
  }
}

// AI response (legacy format)
{
  "type": "ai_response",
  "content": "AI response text",
  "conversation_id": "conv-123",
  "message_id": "msg-123"
}

// Error response
{
  "type": "error",
  "message": "error description"
}

// Workflow step changed
{
  "type": "workflow.step_changed",
  "workflow_id": "wf-123",
  "step": "discovery",
  "agent": "discovery"
}

// Show widget
{
  "type": "widget.show",
  "widget": {
    "id": "widget-123",
    "type": "list_input",
    "config": {"placeholder": "Enter items"}
  }
}

// Agent changed
{
  "type": "agent.changed",
  "agent": "discovery"
}

// Widget completed
{
  "type": "widget.completed",
  "widget_id": "widget-123",
  "success": true
}

// Widget cancelled
{
  "type": "widget.cancelled",
  "widget_id": "widget-123",
  "success": true
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
| `message.send` | Client → Server | User sends a message (new) |
| `message` | Client → Server | User sends a message (legacy) |
| `widget.complete` | Client → Server | Complete widget with data |
| `widget.cancel` | Client → Server | Cancel widget |
| `thinking` | Server → Client | AI is processing the message |
| `message.new` | Server → Client | New message (new format) |
| `ai_response` | Server → Client | AI response text (legacy) |
| `error` | Server → Client | Error occurred |
| `workflow.step_changed` | Server → Client | Workflow step changed |
| `widget.show` | Server → Client | Show widget to user |
| `agent.changed` | Server → Client | Active agent changed |
| `widget.completed` | Server → Client | Widget completed confirmation |
| `widget.cancelled` | Server → Client | Widget cancelled confirmation |
| `collection_created` | Server → Client | AI created a new collection |
| `entity_created` | Server → Client | AI created a new record |
| `entity_updated` | Server → Client | AI updated a record |
| `entity_deleted` | Server → Client | AI deleted a record |

---
Update this file when public interface changes.
