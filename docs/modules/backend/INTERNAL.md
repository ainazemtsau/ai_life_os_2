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
├── workflows/                 # Workflow YAML configurations (legacy)
│   └── onboarding.yaml
├── tests/
│   ├── conftest.py           # Pytest fixtures
│   ├── test_integration.py
│   └── test_workflow_engine.py
└── src/
    ├── __init__.py
    ├── main.py              # FastAPI app, lifespan, CORS, Temporal worker
    ├── config.py            # Settings (includes temporal_host)
    ├── config_loader.py     # Loads agent/workflow configs from YAML
    │
    ├── models/              # Pydantic models
    │   ├── __init__.py
    │   └── workflow_signal.py  # WorkflowSignal, AgentOutput
    │
    ├── temporal/            # Temporal workflow integration
    │   ├── __init__.py
    │   ├── client.py        # Temporal client singleton
    │   ├── worker.py        # Temporal worker setup
    │   ├── activities/      # Temporal activities
    │   │   ├── __init__.py
    │   │   ├── agent.py     # run_workflow_agent activity
    │   │   ├── memory.py    # search_memories, add_memory activities
    │   │   ├── notify.py    # notify_user activity (WebSocket)
    │   │   └── pocketbase.py # DB operation activities
    │   └── workflows/       # Temporal workflows
    │       ├── __init__.py
    │       └── onboarding.py # OnboardingWorkflow
    │
    ├── api/
    │   ├── __init__.py
    │   ├── health.py        # GET /health endpoint
    │   ├── websocket.py     # WS /chat endpoint
    │   ├── test.py          # Test endpoints (temporary)
    │   ├── user.py          # GET /api/user/profile
    │   ├── workflow.py      # Workflow API (uses Temporal queries)
    │   ├── inbox.py         # Inbox API endpoints
    │   └── conversations.py # Conversations API endpoints
    │
    ├── ai/
    │   ├── __init__.py
    │   ├── context.py       # AgentContext, AgentDeps, WorkflowContext
    │   ├── prompts.py       # System prompts
    │   ├── tools.py         # Pocketbase tools for AI
    │   └── agent.py         # PydanticAI agent definition
    │
    └── services/
        ├── __init__.py
        ├── pocketbase.py    # Pocketbase REST API client
        ├── connection_manager.py  # WebSocket (with user_id tracking)
        ├── memory.py        # Mem0 memory service
        ├── conversation.py  # Sends messages to Temporal workflow
        ├── workflow.py      # Legacy workflow service (deprecated)
        ├── agent.py         # Agent registry service
        ├── widget.py        # Widget instances service
        ├── db_init.py       # Database initialization
        ├── completion_criteria.py  # Workflow completion criteria
        └── streaming/       # LLM streaming outside Temporal
            ├── __init__.py
            ├── types.py     # StreamRequest, StreamChunk, StreamResult
            ├── executor.py  # StreamExecutor - runs LLM streaming
            ├── notifier.py  # StreamNotifier - sends WebSocket events
            └── orchestrator.py  # StreamingOrchestrator - coordinates
```

## Key Components

### config.py
- `StreamingConfig` dataclass (frozen, immutable)
  - `stream_start_timeout` - timeout for stream to start (30s)
  - `stream_completion_timeout` - timeout for stream to complete (5min)
  - `disconnect_delay` - delay before WebSocket disconnect (1s)
  - `max_retry_attempts` - retries for transient failures (3)
  - Properties: `disconnect_delay_ms`, `stream_start_timeout_seconds`
  - Singleton: `streaming_config`
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

### models/workflow_signal.py
- `WorkflowAction` enum - actions agents can signal (COMPLETE_STEP, STAY, NEED_INPUT)
- `WorkflowSignal` model - signal from agent to workflow engine
  - `action` - the workflow action to take
  - `data` - data to store in workflow context
  - `reason` - optional explanation
- `AgentOutput` model - structured output from workflow-aware agents
  - `content` - text response to user
  - `workflow_signal` - optional signal to workflow engine
  - Helper methods: `stay()`, `complete()`, `need_input()`

### temporal/client.py
- `get_temporal_client()` - returns Temporal client singleton
- `close_temporal_client()` - closes client connection
- Connects to `settings.temporal_host`

### temporal/worker.py
- `TASK_QUEUE = "ai-life-os"` - task queue name
- `run_worker()` - starts Temporal worker with all activities and workflows
- `stop_worker()` - stops worker gracefully
- Registered workflows: `OnboardingWorkflow`
- Registered activities: `run_workflow_agent`, `search_memories`, `add_memory`,
  `notify_user`, `create_workflow_instance`, `update_workflow_step`, etc.

### temporal/activities/
Activities are the building blocks that perform actual work:
- `agent.py` - `run_workflow_agent(AgentInput)` - runs PydanticAI agent (legacy, blocking)
- `streaming.py` - `start_streaming(StartStreamingInput)` - triggers LLM streaming (non-blocking)
- `memory.py` - `search_memories`, `add_memory` - Mem0 operations
- `notify.py` - `notify_user(NotifyInput)` - sends WebSocket events
- `pocketbase.py` - DB operations (create_workflow_instance, save_message, etc.)

### temporal/workflows/onboarding.py
- `OnboardingWorkflow` - Temporal workflow for user onboarding
- **Inherits**: `StreamingMixin` for LLM streaming support
- **Signals**: `user_message(UserMessage)`, `user_connected()`, `streaming_complete(result)`
- **Queries**: `get_state()`, `get_current_step()`, `get_progress()`
- **Steps**: greeting -> discovery -> brain_dump -> setup_complete
- Step configuration in `ONBOARDING_STEPS` dict
- **Execution paths**:
  - With `request_id`: uses streaming → `start_streaming` activity → wait for signal
  - Without `request_id`: legacy path → `run_workflow_agent` → `notify_user`

### temporal/workflows/mixins/streaming.py
- `StreamingMixin` - adds streaming capabilities to workflows
- `StreamingResult` dataclass - result from streaming service
- Signal: `streaming_complete(result)` - receives streaming completion
- Method: `wait_for_stream(request_id, timeout)` - waits for streaming to finish
- Uses `streaming_config.stream_completion_timeout` as default timeout

### services/workflow.py (DEPRECATED)
- Legacy python-statemachine based workflow service
- Replaced by Temporal workflows
- Kept for reference during migration

### services/completion_criteria.py
- `CriteriaResult` dataclass - result of criteria check (satisfied, missing, data)
- `CompletionCriteriaChecker` abstract base class
- Checker implementations:
  - `AgentSignalChecker` - just needs agent complete_step signal
  - `AgentSignalWithMemoryChecker` - signal + min_facts in Mem0
  - `AgentSignalWithWidgetChecker` - signal + min_items in collection
  - `AutoCompleteChecker` - always satisfied (for final steps)
- Registry functions:
  - `register_checker(name, checker)` - register custom checker
  - `get_checker(name)` - get checker by name
  - `check_completion_criteria(config, instance_id, user_id, signal_data)` - main check function

### services/agent.py
- `AgentConfig` dataclass - agent configuration
- `AgentResponse` dataclass - standardized response (includes workflow_signal)
- `AgentService` class:
  - `register_tool(name, func)` - register tool for agents
  - `register_config(config)` - register agent config
  - `load_config(path)` - load from YAML file
  - `get_agent(name)` - get or create PydanticAI agent
  - `run_agent(agent_name, message, deps)` - execute agent (string output)
  - `run_workflow_agent(agent_name, message, deps)` - execute with structured output
  - `_create_workflow_agent(config)` - create agent with AgentOutput result type
- Singleton: `agent_service`

### ai/context.py
- `AgentContext` dataclass - data available during agent execution
  - `user_id`, `collections`, `recent_records`, `memories`
- `WorkflowContext` dataclass - workflow state for agents
  - `workflow_id`, `instance_id`, `current_step`, `step_agent`
  - `is_required`, `steps_completed`, `step_data`, `shared`
- `AgentDeps` dataclass - dependencies for PydanticAI RunContext
  - `user_id`, `websocket`, `context`, `workflow_context`
  - Methods: `get_collections_summary()`, `get_memories_summary()`
  - Method: `get_workflow_prompt_context()` - formats workflow instructions

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
  - `process_message(user_id, message, websocket)` - sends signal to Temporal workflow
- Singleton: `conversation_service`

### services/connection_manager.py
- `ConnectionManager` class:
  - `connect(websocket)` - accept new connection
  - `disconnect(websocket)` - remove connection
  - `register_user(user_id, websocket)` - associate websocket with user
  - `send_personal(websocket, data)` - send to specific websocket
  - `send_to_user(user_id, data)` - send to all user's websockets
  - `broadcast(data)` - send to all connections
- User tracking for Temporal notify activity
- Singleton: `manager`

### services/db_init.py
- `SYSTEM_COLLECTIONS` - definitions for all system collections
- `init_database()` - creates collections if not exist
- `check_database_ready()` - verify all collections exist
- Collections: workflow_instances, inbox_items, conversations, messages, widget_instances

### services/streaming/ (Hybrid Streaming Architecture)
LLM streaming runs outside Temporal sandbox for real-time updates.

**types.py**:
- `StreamRequest` - immutable request for starting stream
- `StreamChunk` - single chunk with delta and accumulated content
- `StreamResult` - final result with message_id, content, agent_name
- `StreamState` - mutable state during streaming

**executor.py**:
- `StreamExecutor` class - executes LLM streaming via PydanticAI
- Method: `execute(request, deps)` - async generator yielding chunks
- Method: `get_result(request_id)` - get final StreamResult
- Method: `_create_streaming_agent(config, deps)` - creates text-only agent for streaming
- Uses agent's `run_stream()` with `stream_text()` for real-time token streaming
- **Important**: Streaming agent uses simplified system prompt (no workflow signals)

**types.py**:
- `StreamState.update_from_accumulated(new_accumulated)` - handles PydanticAI's accumulated output
  - PydanticAI `stream_text()` returns accumulated text, not delta
  - This method computes delta from the difference

**notifier.py**:
- `StreamNotifier` class - sends events to WebSocket and Temporal
- Protocols: `WebSocketSender`, `TemporalSignaler`
- Methods: `notify_start`, `notify_chunk`, `notify_complete`, `notify_error`
- Sends stream.* events to client, signals workflow on completion

**orchestrator.py**:
- `StreamingOrchestrator` class - coordinates streaming
- Method: `start_stream(request, deps)` - starts in background task
- Method: `cancel_stream(request_id)` - cancels active stream
- Workflow: notify_start → execute → notify_chunks → notify_complete

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
  - `workflow.started` - new workflow started
  - `workflow.step_changed` - workflow step changed
  - `workflow.step_blocked` - step transition blocked (criteria not met)
  - `workflow.completed` - workflow completed
  - `widget.show` - show widget
  - `agent.changed` - active agent changed
  - `collection_created`, `entity_created`, etc. - data events

### api/user.py
- `GET /api/user/profile` - get user profile with memories

### api/workflow.py
- `GET /api/workflow/current` - get active workflow
- `POST /api/workflow/start` - start new workflow
- `POST /api/workflow/{id}/transition` - transition step (manual)
- `GET /api/workflow/list` - list available workflows
- `GET /api/workflow/{id}` - get workflow instance by ID
- `GET /api/workflow/{id}/progress` - get progress (step, percent, completed)
- `POST /api/workflow/{id}/signal` - send manual signal (for testing)

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
7. **Start Temporal worker** (background task)
8. Log "Backend started"

### WebSocket Message Flow (Temporal-based)
1. Client connects → `manager.connect()`
2. Client sends `{"type": "message.send", "content": "...", "user_id": "..."}`
3. **Register user's websocket** → `manager.register_user(user_id, websocket)`
4. Send "thinking" event to client
5. **Get Temporal client** → `get_temporal_client()`
6. **Get or start workflow**:
   - Try to get existing workflow handle
   - If not found, start new OnboardingWorkflow
7. **Send signal** → `handle.signal(OnboardingWorkflow.user_message, UserMessage(...))`
8. Return immediately (response delivered via workflow)

### Temporal Workflow Execution
1. **Signal received**: `user_message` signal triggers `pending_messages.append()`
2. **Wait condition satisfied**: Workflow wakes up
3. **Send "thinking"** via notify_user activity
4. **Save user message** via save_message activity
5. **Load context**:
   - `search_memories` activity → Mem0
   - `get_user_collections` activity → Pocketbase
6. **Run agent** via `run_workflow_agent` activity:
   - Rebuilds AgentDeps from serialized input
   - Calls agent_service.run_workflow_agent()
   - Returns AgentResult with content + workflow_signal
7. **Notify user** via notify_user activity → WebSocket `message.new`
8. **Save assistant message** via save_message activity
9. **Add to memory** via add_memory activity
10. **Process signal**:
    - `complete_step`: transition to next step if criteria met
    - `stay`: continue on current step
    - `need_input`: wait for widget
11. **Transition** (if complete_step):
    - Update state
    - Update DB via update_workflow_step activity
    - Notify via notify_user activity → `workflow.step_changed`
12. **Loop** until workflow completed

### Temporal Architecture
```
Frontend → WebSocket → FastAPI → Temporal Client → signal
                                       ↓
                              Temporal Server
                                       ↓
                              Temporal Worker
                                       ↓
                              OnboardingWorkflow
                                       ↓
                              Activities
                              ├── run_workflow_agent → PydanticAI
                              ├── search_memories → Mem0
                              ├── notify_user → WebSocket → Frontend
                              └── save_message → Pocketbase
```

### Benefits of Temporal
- **Durable execution**: Workflow survives backend restarts
- **Built-in signals/queries**: No custom event system needed
- **Retry logic**: Activities can retry on failure
- **Temporal UI**: Visual debugging at http://localhost:8088
- **State persistence**: Workflow state stored in Temporal

---

## Testing

### Running Unit Tests
```bash
# All tests
docker-compose exec backend pytest tests/ -v

# Specific file
docker-compose exec backend pytest tests/test_workflow_engine.py -v

# Specific test class
docker-compose exec backend pytest tests/test_workflow_engine.py::TestWorkflowSignalModels -v
```

### Manual Testing Checklist

#### 1. Verify Services Are Running
```bash
docker-compose ps
```
Expected: All 7 containers running (backend, frontend, pocketbase, redis, temporal, temporal-postgresql, temporal-ui)

#### 2. Check Temporal UI
- Open http://localhost:8088
- Should see "default" namespace
- No errors in the UI

#### 3. Test WebSocket Chat Flow
1. Open http://localhost:3000
2. Send a message: "Привет"
3. **Expected**:
   - See "thinking" indicator
   - Receive greeting response from `greeter` agent
   - Check Temporal UI → Workflows → should see `onboarding-{user_id}`

#### 4. Test Workflow Step Transition
1. Continue chatting with the greeter
2. When greeter completes, agent should signal `complete_step`
3. **Expected**:
   - WebSocket receives `workflow.step_changed` event
   - Current step changes from `greeting` → `discovery`
   - Agent changes to `discovery`

#### 5. Test Workflow Persistence (Durable Execution)
1. Start a conversation, get to `discovery` step
2. Restart backend: `docker-compose restart backend`
3. Send another message
4. **Expected**:
   - Workflow continues from `discovery` step (not restart from `greeting`)
   - Check Temporal UI → workflow history shows continuation

#### 6. Test Memory Integration
1. Tell the agent some facts about yourself
2. In a new message, ask "What do you know about me?"
3. **Expected**:
   - Agent recalls previously mentioned facts
   - Check Redis for stored memories

#### 7. Test API Endpoints
```bash
# Health check
curl http://localhost:8000/health

# Get current workflow (replace USER_ID)
curl "http://localhost:8000/api/workflow/current?user_id=USER_ID"

# Get workflow progress
curl "http://localhost:8000/api/workflow/{workflow_id}/progress"
```

#### 8. Check Backend Logs
```bash
docker-compose logs -f backend
```
Look for:
- `Starting Temporal worker on queue: ai-life-os`
- `Connecting to Temporal server at temporal:7233`
- `Started workflow: onboarding-{user_id}`
- `Sent message signal to workflow`

#### 9. Check Temporal Workflow Details
1. Open http://localhost:8088
2. Click on a workflow
3. Check:
   - **Input**: user_id, initial_context
   - **Pending Activities**: should be empty when idle
   - **History**: shows all activities executed
   - **Queries**: can query `get_state`, `get_progress`

#### 10. Test Error Handling
1. Stop Temporal: `docker-compose stop temporal`
2. Try sending a message
3. **Expected**: Error message in WebSocket
4. Restart Temporal: `docker-compose start temporal`
5. Workflow should resume automatically

---
Update this file when internal structure changes.
