# Queries

## Overview

Database query functions provide typed access to messages, conversations, and assistants. Functions return domain models (from `@ai-life-os/contracts`) rather than raw database rows. Status transition validation enforces the message lifecycle state machine.

## Architecture

```
Domain Model (contracts package)
    ^
    |
toMessage/toConversation/toAssistant (mapping layer)
    ^
    |
Supabase Client (database rows)
```

## Design Decisions

**Parent ID on Messages**: Messages use `parent_id` foreign key for tree structure instead of separate edges table. This enables simple recursive queries and matches assistant-ui's mental model. Edges table would require joining two tables for every message fetch without providing clear benefit for Phase 1 branching requirements.

**Hard Delete with Cascade**: Deleting an assistant or conversation cascades to related records. This is acceptable for single-user Phase 1 since data can be recreated. Soft delete would accumulate deleted records without benefit. Future multi-user may require soft delete for audit trails.

**Status Transition Validation**: `updateMessage` validates status transitions via `VALID_TRANSITIONS` map before updating database. Invalid transitions (e.g., complete→streaming) are rejected with error. This prevents data corruption from bugs in calling code. Validation is synchronous (fetches current status before update) - acceptable tradeoff for data integrity.

**Application-Layer Tree Traversal**: `getMessageTree` traverses parent relationships in application code rather than database recursive CTE. This avoids requiring RPC functions (better compatibility across Supabase deployment modes). Performance is acceptable for Phase 1 conversation depths. Future optimization would use PostgreSQL recursive CTE if profiling shows need.

## Invariants

1. **Valid parent references**: Every message (except root) has `parent_id` pointing to existing message in same conversation
2. **Cascade consistency**: Deleting conversation deletes all messages; deleting assistant deletes all conversations
3. **Status machine enforcement**: Only allowed transitions are pending→streaming, streaming→complete|error|stopped
