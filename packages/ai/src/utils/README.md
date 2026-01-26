# Utils

## Overview

Utilities for context window management and API reliability. Context truncation prevents token limit errors while preserving critical context. Retry mechanism handles transient API failures with exponential backoff.

## Design Decisions

**Context Truncation from Oldest**: When messages exceed token limit, oldest messages are removed first while always preserving system prompt and last 4 messages (2 user-assistant pairs minimum). Alternative semantic-aware truncation (remove low-relevance messages) was deferred due to complexity. Current approach is simple and predictable.

**5 Attempts with Exponential Backoff**: Retry delays are 2s, 4s, 8s, 16s, 32s (max 62s total wait). This accommodates longer outages without overwhelming the API. 3 attempts with short delays was rejected as insufficiently resilient for unreliable networks.

**Forward Accumulation Pattern**: `truncateContext` accumulates messages from oldest to newest until budget exhausted. This pattern naturally produces the correct slice endpoint. DO NOT refactor to backwards accumulation with removeCount - that pattern tracks messages that DON'T fit, causing off-by-one errors.

## Invariants

1. **System prompt always included**: Token counting includes system prompt, truncation never removes it
2. **Minimum context preserved**: Last 4 messages always included regardless of token budget (prevents empty context)
3. **Token budget respected**: Total tokens (system + messages) never exceed maxTokens parameter
