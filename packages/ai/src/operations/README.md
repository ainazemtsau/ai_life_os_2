# Message Operations

## Overview

Modular operations layer providing reusable business logic for message manipulation. Created to avoid duplication across API routes and establish foundation for future operations (delete, pin, reactions).

## Architecture

```
User Action (UI)
       |
       v
Chat Runtime (state management)
       |
       v
API Route (HTTP/validation layer)
       |
       v
Operation (business logic) ──> branchWorkflow
       |
       v
Database (Supabase)
```

Operations separate business logic from HTTP concerns, enabling:
- Reuse across multiple API endpoints
- Testing without HTTP layer
- Consistent error handling
- Clear separation of concerns

## Design Decisions

**Why operations layer instead of direct workflow calls?**
API routes calling workflows directly leads to validation duplication and tightly couples HTTP to workflow implementation. Operations layer provides stable interface that can orchestrate multiple workflows, apply business rules, and transform data without routes knowing implementation details.

**Why async generators for streaming?**
Async generators provide natural cancellation via AbortSignal, memory-efficient chunk yielding, and clean error propagation via throw. Pattern matches existing branchWorkflow implementation for consistency.

**Why MessageOperationInput base interface?**
All message operations require client (database access), messageId (target), and abortSignal (cancellation). Base interface enforces consistency and reduces duplication. Operation-specific inputs extend base.
