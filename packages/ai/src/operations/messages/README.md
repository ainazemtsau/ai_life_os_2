# Message Operations

## Overview

Operations for message manipulation implementing ChatGPT-style branching. Edit operations create sibling messages instead of mutating originals, preserving conversation history and enabling branch navigation.

## Data Flow

```
User message (parent_id: null)
       |
       +---> Assistant v1 (parent_id: user.id) [sibling 1/3]
       |
       +---> Assistant v2 (parent_id: user.id) [sibling 2/3] <-- active
       |
       +---> Assistant v3 (parent_id: user.id) [sibling 3/3]

activeBranches[user.id] = "assistant_v2_id"
```

## Design Decisions

**Why create siblings instead of in-place editing?**
ChatGPT branching model preserves all conversation versions, allowing users to explore different conversation paths and return to previous responses. In-place editing loses this history and prevents comparison of assistant responses.

**Why branchWorkflow integration?**
branchWorkflow already implements correct sibling creation logic (same parent_id, proper tree structure). Reusing workflow avoids duplication and maintains consistency with regenerate functionality.

**Why AbortSignal in operation input?**
Users can navigate away during streaming or close tabs mid-operation. AbortSignal enables graceful cancellation, preventing orphaned workflows, cleaning up resources, and avoiding partial database writes.

## Invariants

- Edit operations always create new sibling message, never mutate existing
- All siblings share same parent_id
- Operations must respect AbortSignal for cancellation
- Streaming responses must be cancellable at any chunk
