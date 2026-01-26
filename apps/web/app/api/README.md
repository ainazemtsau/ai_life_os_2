# API Routes

## Overview

Next.js API route handlers act as thin HTTP adapters that delegate business logic to Mastra workflows. Routes handle request validation, error formatting, and streaming response conversion, but contain no business logic.

## Architecture

```
HTTP Request
    |
    v
API Route (adapter layer)
    |
    +---> Zod validation
    |
    +---> Workflow invocation
    |
    +---> ReadableStream conversion
    |
    v
HTTP Response (streaming)
```

## Design Decisions

**Thin Adapters Over Direct Logic**: Routes contain only HTTP concerns (parsing, validation, response formatting). All business logic lives in workflows. This prevents duplication across endpoints and enables testing workflows in isolation without HTTP mocking.

**ReadableStream for Streaming**: Async generator from workflow is converted to ReadableStream using standard Web APIs. This works with Next.js edge runtime and avoids dependency on Vercel AI SDK's higher-level abstractions. Alternative StreamingTextResponse was considered but rejected for simplicity.

**Abort Signal Propagation**: `request.signal` is passed directly to workflows, enabling stop functionality without custom cancellation logic. When user clicks stop, browser cancels request, signal aborts, workflow catches abort and sets status=stopped.

**Hardcoded User ID**: Phase 1 assumes single user with hardcoded UUID '00000000-0000-0000-0000-000000000001'. Real authentication is deferred to Phase 2. This allows testing full functionality without auth complexity. Migration to real auth requires adding middleware to extract user ID from session.

## Error Handling

- Zod validation errors return 400 with error details
- Missing resources (conversation, message, assistant) return 404
- Workflow errors (OpenAI failures, database errors) return 500
- Abort signal errors are NOT returned (client already disconnected)
