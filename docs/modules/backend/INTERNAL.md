# Module: backend — Internal Structure

## File Structure
```
backend/
├── Dockerfile
├── requirements.txt
└── src/
    ├── __init__.py
    ├── main.py              # FastAPI app, lifespan, CORS
    ├── config.py            # Settings from environment variables
    │
    ├── api/
    │   ├── __init__.py
    │   ├── health.py        # GET /health endpoint
    │   ├── websocket.py     # WS /chat endpoint
    │   └── test.py          # Test endpoints (temporary)
    │
    ├── ai/
    │   ├── __init__.py
    │   ├── context.py       # AgentContext, AgentDeps
    │   ├── prompts.py       # System prompts
    │   ├── tools.py         # Pocketbase tools for AI
    │   └── agent.py         # PydanticAI agent definition
    │
    └── services/
        ├── __init__.py
        ├── pocketbase.py    # Pocketbase REST API client
        ├── connection_manager.py  # WebSocket connection manager
        ├── memory.py        # Mem0 memory service
        └── conversation.py  # Conversation service (AI orchestration)
```

## Key Components

### config.py
- `Settings` class using pydantic-settings
- Loads from environment variables
- Validates required fields (pocketbase_url, redis_url)
- Mem0 settings: `mem0_llm_provider`, `mem0_llm_model`, `mem0_embedder_provider`, `mem0_embedder_model`
- AI Agent settings: `llm_provider`, `llm_model`
- Method: `get_mem0_config()` - builds Mem0 configuration dict
- Method: `get_llm_model()` - returns model string for pydantic-ai
- Singleton: `settings`

### ai/context.py
- `AgentContext` dataclass - context data for agent
  - `user_id`, `collections`, `recent_records`, `memories`
- `AgentDeps` dataclass - dependencies for PydanticAI
  - `user_id`, `websocket`, `context`
  - Methods: `get_collections_summary()`, `get_memories_summary()`

### ai/prompts.py
- `COORDINATOR_SYSTEM_PROMPT` - base system prompt
- `build_system_prompt(collections, memories)` - builds dynamic prompt

### ai/tools.py
- Tools for AI to interact with Pocketbase:
  - `list_collections()` - list user collections
  - `create_collection(name, fields)` - create new collection
  - `list_records(collection, filter)` - list records
  - `create_record(collection, data)` - create record
  - `update_record(collection, record_id, data)` - update record
  - `delete_record(collection, record_id)` - delete record
- Sends WebSocket events on data changes
- `SYSTEM_COLLECTIONS` - set of collections to exclude

### ai/agent.py
- `create_agent()` - creates PydanticAI agent with tools
- `_dynamic_system_prompt()` - builds context-aware system prompt
- `coordinator_agent` - singleton agent instance

### services/connection_manager.py
- `ConnectionManager` class for WebSocket connections
- Methods: `connect()`, `disconnect()`, `send_personal()`, `broadcast()`
- Singleton: `manager`

### services/pocketbase.py
- `PocketbaseService` class for Pocketbase REST API
- Methods: `health_check()`, `list_collections()`, `get_collection()`, `create_collection()`, `list_records()`, `get_record()`, `create_record()`, `update_record()`, `delete_record()`
- `PocketbaseError` exception class
- Singleton: `pocketbase`

### services/memory.py
- `MemoryService` class for Mem0 long-term memory
- Constructor: `__init__(user_id: str)` - creates service for specific user
- Methods:
  - `add(messages: list[dict])` - add messages, Mem0 extracts important info
  - `search(query: str, limit: int)` - semantic search for relevant memories
  - `get_all(limit: int)` - get all user memories
- Property: `is_available` - check if Mem0 is working
- Function: `check_memory_service()` - health check for startup
- Graceful degradation: if Redis/Mem0 unavailable, returns empty results

### services/conversation.py
- `ConversationService` class for processing messages
- Method: `process_message(user_id, message, websocket)`
  1. Sends "thinking" WS event
  2. Loads context (collections, memories)
  3. Runs AI agent
  4. Saves to Mem0
  5. Returns response
- `ConversationResult` dataclass for results
- Singleton: `conversation_service`

### api/websocket.py
- WebSocket endpoint `/chat`
- Handles message type "message"
- Sends events: thinking, ai_response, error
- Tool events sent from tools: collection_created, entity_created, entity_updated, entity_deleted

### api/test.py
- Temporary test endpoints for debugging
- Memory test endpoints
- `POST /test/ai/chat` - test AI without WebSocket

### main.py
- FastAPI application with lifespan
- CORS middleware (localhost:3000)
- Checks Pocketbase and Mem0 connections on startup
- Includes health, websocket, and test routers

## Internal Flow

### Startup
1. Load settings from environment
2. Configure logging
3. Check Pocketbase health
4. Check Mem0/Memory service health
5. Log "Backend started"

### WebSocket Message Flow
1. Client connects → `manager.connect()`
2. Client sends `{"type": "message", "content": "...", "user_id": "..."}`
3. Send "thinking" event to client
4. Load context (collections from Pocketbase, memories from Mem0)
5. Run AI agent with context
6. Agent may call tools (create collection, records, etc.)
7. Tools send events (entity_created, etc.) via WebSocket
8. Return AI response via "ai_response" event
9. Save conversation to Mem0

### AI Agent Flow
1. Receive user message
2. Build system prompt with current context
3. LLM processes message and may call tools
4. Tools execute Pocketbase operations
5. Tools send WebSocket events on changes
6. Return text response

### Memory Flow
1. Create `MemoryService(user_id)`
2. After conversation: `service.add(messages)` - Mem0 extracts facts
3. Before response: `service.search(query)` - find relevant memories
4. Memories added to AI context for personalized responses

---
Update this file when internal structure changes.
