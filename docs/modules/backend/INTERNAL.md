# Module: backend — Internal Structure

## File Structure
```
backend/
├── Dockerfile
├── requirements.txt
├── agents/                    # Agent YAML configurations
│   ├── coordinator.yaml
│   ├── greeter.yaml
│   ├── discovery.yaml
│   └── inbox_collector.yaml
├── workflows/                 # Workflow YAML configurations
│   └── onboarding.yaml
├── tests/
│   └── test_integration.py
└── src/
    ├── __init__.py
    ├── main.py              # FastAPI app, lifespan, CORS
    ├── config.py            # Settings from environment variables
    ├── config_loader.py     # Loads agent/workflow configs from YAML
    │
    ├── api/
    │   ├── __init__.py
    │   ├── health.py        # GET /health endpoint
    │   ├── websocket.py     # WS /chat endpoint
    │   ├── test.py          # Test endpoints (temporary)
    │   ├── user.py          # GET /api/user/profile
    │   ├── workflow.py      # Workflow API endpoints
    │   ├── inbox.py         # Inbox API endpoints
    │   └── conversations.py # Conversations API endpoints
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
        ├── conversation.py  # Conversation service (AI orchestration)
        ├── workflow.py      # Workflow state machine service
        ├── agent.py         # Agent registry service
        ├── widget.py        # Widget instances service
        └── db_init.py       # Database initialization
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

### config_loader.py
- `load_agent_configs(directory)` - loads all agent YAML configs
- `load_workflow_configs(directory)` - loads all workflow YAML configs
- `load_all_configs()` - loads both agents and workflows
- Called at startup from main.py

### services/workflow.py
- `WorkflowInstance` dataclass - workflow instance data
- `DynamicWorkflowMachine` - python-statemachine based state machine
- `WorkflowService` class:
  - `register_workflow(name, config)` - register workflow config
  - `start_workflow(user_id, workflow_name)` - create new instance
  - `get_active_workflow(user_id)` - get user's active workflow
  - `get_current_step(instance_id)` - get step info
  - `can_transition(instance_id, to_step)` - check if transition allowed
  - `transition(instance_id, to_step, data)` - move to next step
  - `pause_workflow()`, `resume_workflow()`, `complete_workflow()`
- Singleton: `workflow_service`

### services/agent.py
- `AgentConfig` dataclass - agent configuration
- `AgentResponse` dataclass - standardized response
- `AgentService` class:
  - `register_tool(name, func)` - register tool for agents
  - `register_config(config)` - register agent config
  - `load_config(path)` - load from YAML file
  - `get_agent(name)` - get or create PydanticAI agent
  - `run_agent(agent_name, message, deps)` - execute agent
- Singleton: `agent_service`

### services/widget.py
- `WidgetInstance` dataclass - widget instance data
- `WidgetService` class:
  - `create_widget(message_id, widget_type, config)` - create widget
  - `get_widget(widget_id)` - get widget by ID
  - `get_pending_widget(conversation_id)` - get pending widget
  - `activate_widget(widget_id)` - set to active
  - `complete_widget(widget_id, data)` - complete with data
  - `cancel_widget(widget_id)` - cancel widget
- Singleton: `widget_service`

### services/conversation.py
- `ConversationData` dataclass - conversation data
- `MessageData` dataclass - message data
- `ConversationResult` dataclass - processing result
- `ConversationService` class:
  - `create_conversation(user_id, agent_name)` - create new
  - `get_active_conversation(user_id)` - get active
  - `get_or_create_conversation(user_id)` - get or create
  - `add_message(conversation_id, role, content)` - add message
  - `get_history(conversation_id, limit)` - get messages
  - `complete_conversation(conversation_id)` - mark complete
  - `process_message(user_id, message, websocket)` - full processing
- Singleton: `conversation_service`

### services/db_init.py
- `SYSTEM_COLLECTIONS` - definitions for all system collections
- `init_database()` - creates collections if not exist
- `check_database_ready()` - verify all collections exist
- Collections: workflow_instances, inbox_items, conversations, messages, widget_instances

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

### api/websocket.py
- WebSocket endpoint `/chat`
- Incoming messages:
  - `message.send` / `message` - send chat message
  - `widget.complete` - complete widget with data
  - `widget.cancel` - cancel widget
- Outgoing messages:
  - `thinking` - AI processing
  - `message.new` - new message
  - `ai_response` - AI response (legacy)
  - `workflow.step_changed` - workflow step changed
  - `widget.show` - show widget
  - `agent.changed` - active agent changed
  - `collection_created`, `entity_created`, etc. - data events

### api/user.py
- `GET /api/user/profile` - get user profile with memories

### api/workflow.py
- `GET /api/workflow/current` - get active workflow
- `POST /api/workflow/start` - start new workflow
- `POST /api/workflow/{id}/transition` - transition step
- `GET /api/workflow/list` - list available workflows

### api/inbox.py
- `GET /api/inbox` - list inbox items
- `POST /api/inbox` - create inbox item
- `PATCH /api/inbox/{id}/status` - update status
- `DELETE /api/inbox/{id}` - delete item

### api/conversations.py
- `GET /api/conversations/active` - get active conversation
- `GET /api/conversations/{id}` - get conversation with history
- `POST /api/conversations/{id}/complete` - mark complete

## Internal Flow

### Startup
1. Load settings from environment
2. Configure logging
3. Check Pocketbase health
4. Initialize database collections
5. Load agent and workflow configurations
6. Check Mem0/Memory service health
7. Log "Backend started"

### WebSocket Message Flow
1. Client connects → `manager.connect()`
2. Client sends `{"type": "message.send", "content": "...", "user_id": "..."}`
3. Get or create conversation
4. Save user message to DB
5. Send "thinking" event to client
6. Load context (collections from Pocketbase, memories from Mem0)
7. Run AI agent with context
8. Agent may call tools (create collection, records, etc.)
9. Save assistant message to DB
10. Return AI response via "message.new" and "ai_response" events
11. Save conversation to Mem0

### Workflow Flow
1. Start workflow via `workflow_service.start_workflow()`
2. Get current step with `get_current_step()`
3. Step determines which agent handles messages
4. Agent processes and can trigger transition
5. `transition()` moves to next step
6. Workflow completes when reaching final step

---
Update this file when internal structure changes.
