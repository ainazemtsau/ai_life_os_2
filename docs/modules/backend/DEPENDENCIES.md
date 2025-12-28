# Module: backend — Dependencies

## External Services

| Service | URL | Purpose |
|---------|-----|---------|
| Pocketbase | http://pocketbase:8090 | Data storage, REST API |
| Redis Stack | redis://redis:6379 | Vector store for Mem0 (requires RediSearch module) |
| OpenAI API | https://api.openai.com | LLM for AI Agent and embeddings for Mem0 |
| Anthropic API | https://api.anthropic.com | Alternative LLM for AI Agent |

## Other Modules

| Module | Usage |
|--------|-------|
| frontend | Connects via WebSocket to /chat |

## Packages

| Package | Version | Purpose |
|---------|---------|---------|
| fastapi | >=0.115.0 | Web framework |
| uvicorn[standard] | >=0.32.0 | ASGI server |
| websockets | >=12.0 | WebSocket support |
| httpx | >=0.27.0 | Async HTTP client |
| pydantic | >=2.0 | Data validation |
| pydantic-settings | >=2.0 | Settings management |
| python-dotenv | >=1.0.0 | .env file loading |
| mem0ai | >=0.1.0 | Long-term memory for AI |
| redis | >=5.0.0 | Redis client |
| redisvl | >=0.3.0 | Redis vector library for Mem0 |
| openai | >=1.0.0 | OpenAI API client |
| pydantic-ai | >=0.0.30 | AI agent framework |
| anthropic | >=0.40.0 | Anthropic API client |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| POCKETBASE_URL | Yes | http://pocketbase:8090 | Pocketbase API URL |
| POCKETBASE_ADMIN_EMAIL | Yes* | - | Pocketbase admin email (*required for AI to create collections) |
| POCKETBASE_ADMIN_PASSWORD | Yes* | - | Pocketbase admin password |
| REDIS_URL | Yes | redis://redis:6379 | Redis connection URL |
| ANTHROPIC_API_KEY | No | - | Anthropic API key |
| OPENAI_API_KEY | No* | - | OpenAI API key (*required for Mem0 with OpenAI) |
| OLLAMA_HOST | No | - | Ollama host URL |
| OLLAMA_MODEL | No | - | Ollama model name |
| LLM_PROVIDER | No | openai | LLM provider for AI Agent (openai/anthropic/ollama) |
| LLM_MODEL | No | gpt-4o | LLM model for AI Agent |
| MEM0_LLM_PROVIDER | No | openai | LLM provider for Mem0 (openai/anthropic/ollama) |
| MEM0_LLM_MODEL | No | gpt-4o-mini | LLM model for Mem0 memory extraction |
| MEM0_EMBEDDER_PROVIDER | No | openai | Embedder provider for Mem0 |
| MEM0_EMBEDDER_MODEL | No | text-embedding-3-small | Embedding model for Mem0 |
| LOG_LEVEL | No | INFO | Logging level |

---
Update this file when dependencies change.
