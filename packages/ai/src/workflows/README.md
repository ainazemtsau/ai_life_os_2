# Workflows

## Overview

Mastra workflows encapsulate business logic for chat, branching, and regeneration. Workflows live in packages/ai/ to enable reuse across multiple clients (web app, future CLI, future Discord bot) without circular dependencies. Next.js API routes act as thin HTTP adapters that delegate to workflows.

## Architecture

```
API Route (HTTP adapter)
    |
    v
Workflow (business logic)
    |
    +---> Supabase (persistence)
    |
    +---> OpenAI (AI streaming)
```

Workflows handle:
- Message creation with status lifecycle
- Streaming response from OpenAI
- Incremental content updates to database
- Error handling and retry logic
- Abort signal propagation for stop functionality

## Design Decisions

**Status Lifecycle**: Messages transition through pending → streaming → complete|error|stopped. Invalid transitions are rejected at the workflow level via `VALID_TRANSITIONS` map in `messages.ts`. This prevents data corruption from bugs in calling code.

**Chunk-by-Chunk Persistence**: Each streaming chunk updates the database immediately. This trades latency for durability - partial responses survive crashes. Alternative would buffer in memory and save once at completion, but user loses work on connection loss.

**Parent ID for Branching**: Edited messages create new siblings with the same `parent_id`. Branch workflow reuses chat workflow by passing edited content as a new message. This avoids duplicating streaming logic across workflows.

**Regeneration as Sibling**: Regenerating an assistant message creates a new message with the same `parent_id` (the triggering user message). Multiple regenerations create multiple siblings, navigable via branch navigator UI.

## Invariants

1. **Message tree consistency**: Every message (except root) must have valid `parent_id` pointing to existing message in same conversation
2. **Status transitions**: Only allowed transitions are pending→streaming, streaming→complete|error|stopped. Terminal states (complete, error, stopped) cannot transition.
3. **System prompt preservation**: Context truncation must never remove system prompt
4. **Single assistant per conversation**: `conversation.assistant_id` is immutable after creation
