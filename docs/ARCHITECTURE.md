# Architecture

## Overview

AI-first workspace where user interacts with AI assistant through chat.
AI creates and manages data structures. User sees results in real-time.

## System Components

```
┌──────────┐         WebSocket           ┌──────────┐
│ Frontend │◄───────────────────────────►│ Backend  │
│ (React)  │  - chat messages            │ (FastAPI)│
│          │  - entity events            │          │
└──────────┘                             └────┬─────┘
                                              │
                              ┌───────────────┼───────────────┐
                              │               │               │
                              ▼               ▼               ▼
                        ┌──────────┐   ┌──────────┐   ┌──────────┐
                        │Pocketbase│   │  Mem0    │   │ LLM API  │
                        │ (data)   │   │ (memory) │   │(Claude/  │
                        │          │   │          │   │ GPT)     │
                        └──────────┘   └──────────┘   └──────────┘
```

## Data Flow

1. User sends message via WebSocket
2. Backend receives message
3. Backend loads context (collections, recent entities, memories)
4. Backend calls AI agent with context
5. AI agent decides actions, calls tools
6. Tools modify data in Pocketbase
7. Backend sends events to Frontend via same WebSocket
8. Frontend updates UI
9. Backend saves important info to Mem0

## Key Decisions

- Single WebSocket connection (Frontend ↔ Backend)
- Backend sends all events (AI responses, data changes)
- Pocketbase for dynamic data (AI creates collections)
- Mem0 for AI memory (persists between sessions)
- No conversation history stored (only Mem0 extracts)
