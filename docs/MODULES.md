# Modules

## Module List

| Module | Path | Type | Description |
|--------|------|------|-------------|
| backend | /backend | internal | FastAPI server, WebSocket, AI orchestration |
| frontend | /frontend | internal | React UI, chat, entity display |
| pocketbase | /pocketbase | external | Data storage, auto REST API |

## Module Communication

```
frontend ──WebSocket──► backend ──HTTP──► pocketbase
                            │
                            ├──► mem0 (redis)
                            └──► llm api (external)
```

## Rules

1. Frontend only communicates with Backend (WebSocket)
2. Frontend never calls Pocketbase directly
3. Backend is the only module that calls Pocketbase
4. Backend is the only module that calls LLM API
5. Backend is the only module that uses Mem0
