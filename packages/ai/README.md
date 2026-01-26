# @ai-life-os/ai

## Overview

Mastra agents, workflows, tools, and prompt configuration for AI Life OS. Provides a configured Mastra instance with model registry, system prompts, and agent definitions. Enables streaming AI responses with tool calling and multi-step workflows.

## Architecture

Mastra is organized into three directories with distinct purposes:

- **`agents/`**: Agent definitions (system prompt + tools + model). Agents are stateless; they receive context in each request.
- **`workflows/`**: Multi-step orchestrations that compose agents and tools. Workflows maintain state across steps.
- **`tools/`**: Functions agents can call (database queries, API calls, computations). Tools must return JSON-serializable results.

Central configuration lives in:

- **`config.ts`**: Mastra instance with registered agents, workflows, and models. Imports all agents/workflows for runtime access.
- **`prompts.ts`**: System prompts shared across agents. `buildSystemPrompt()` injects user context into base prompts.

## Design Decisions

### Why Mastra over LangChain or custom implementation

Mastra provides built-in streaming, tool calling, and Vercel AI SDK integration. LangChain has higher abstraction overhead; custom implementation requires reinventing streaming/tool execution. We accept Mastra's opinionated structure for faster development.

### Why separate agents/ workflows/ tools/

Mastra requires this organization for agent registry. Separate directories make it explicit where each component type lives, reducing search time for agents/developers. Tools are reusable across agents; keeping them separate avoids duplication.

### Why centralized model registry (config.ts)

Model selection must be consistent across agents. A central registry ensures all agents use the same model IDs and prevents typos. `getModel(id)` provides a type-safe accessor that throws if the model is not registered.

### Why buildSystemPrompt() instead of hardcoded prompts

System prompts need dynamic context (user name, chat history length, current date). `buildSystemPrompt()` accepts context object and injects it into template. This keeps prompts DRY and testable.

### Why stateless agents

Mastra agents do not persist state between calls. State (chat history, user memory) lives in Supabase. Agents receive context as input and return responses. This separation enables horizontal scaling and simplifies testing.

## Invariants

1. **All agents must be registered in config.ts**: Agents not in the registry are not accessible at runtime. Add new agents to `mastra` instance creation.
2. **Tools must return JSON-serializable values**: Mastra serializes tool results for LLM consumption. Returning functions, classes, or circular structures will break execution.
3. **Workflows must handle tool errors**: Tools can fail (network errors, invalid input). Workflows must catch errors and provide fallback responses instead of crashing.
4. **System prompts must not leak implementation details**: Prompts should describe capabilities, not internal architecture. Avoid mentioning "Supabase" or "Mastra" in user-facing prompts.
5. **Model IDs must match provider configuration**: `getModel('gpt-4o')` requires model to be registered in `config.ts`. Missing models throw at runtime.
6. **Empty context in buildSystemPrompt returns base prompt**: `buildSystemPrompt(base, undefined)` or `buildSystemPrompt(base, '')` returns base without modification. This is valid for generic assistants without user context.

## Phase 1: Chat Workflows

### Architecture

```
User Message
     |
     v
+-----------------+
| Chat Workflow   |
+-----------------+
     |
     +---> Create user message (status=complete)
     +---> Create assistant message (status=pending)
     +---> Truncate context (preserve system prompt + last 4 messages)
     +---> OpenAI stream (with retry: 5 attempts, exponential backoff)
     |         |
     |         +---> Update status: pending -> streaming
     |         +---> Yield chunks
     |         +---> Update content incrementally
     |         +---> Update status: streaming -> complete|error|stopped
     |
     v
Supabase (message tree with parent_id)
```

### Data Flow

**Send Message (chat.workflow.ts)**
1. Fetch conversation and assistant config
2. Create user message with status=complete
3. Create assistant message with status=pending
4. Build message history, apply context truncation
5. Stream from OpenAI (with retry wrapper)
6. Update assistant message: status=streaming
7. For each chunk: yield to client
8. On completion: save full content, status=complete
9. On error: status=error with metadata
10. On abort: status=stopped

**Edit Message (branch.workflow.ts)**
1. Fetch original message to get parent_id and conversation_id
2. Delegate to chat workflow with new content
3. New message shares parent_id (creates sibling branch)
4. Original branch preserved for navigation

**Regenerate (regenerate.workflow.ts)**
1. Fetch assistant message to get parent_id (user message)
2. Fetch user message content
3. Create new assistant message with same parent_id (sibling)
4. Delegate to chat workflow with user content
5. Multiple regenerations create multiple sibling variants

### Phase 1 Invariants

1. **Status lifecycle**: pending -> streaming -> complete | error | stopped (no other transitions)
2. **Status transition validation**: updateMessage enforces state machine, rejects invalid transitions
3. **System prompt preservation**: Context truncation never removes system prompt
4. **Last 4 messages preserved**: Truncation always keeps minimum 2 user-assistant pairs
5. **Parent_id consistency**: Branching and regeneration create siblings by sharing parent_id

### Tradeoffs

- **Consistency over performance**: Save each streaming chunk to DB (trades latency for durability, partial responses survive crashes)
- **Simplicity over flexibility**: Hardcoded 4-message minimum, single provider (OpenAI only)
- **Retry resilience**: 5 attempts with 62s max wait (accommodates longer outages, acceptable latency tradeoff)

### Context Truncation

Algorithm (utils/context-truncation.ts):
1. Count tokens: system prompt + all messages
2. If under limit: return all messages
3. Reserve last 4 messages (2 user-assistant pairs minimum)
4. Accumulate oldest messages until budget exhausted
5. Return: fitting messages + reserved last 4

Token counting: tiktoken with gpt-5-mini encoding

### Retry Policy

5 attempts with exponential backoff: 2s, 4s, 8s, 16s, 32s (max 62s total wait)

Rationale: More resilient for unreliable networks, longer backoff allows service recovery time

## Observability

### Architecture

Token tracking and error logging are modular utilities, separate from workflow orchestration. Vercel AI SDK callbacks (`onFinish`, `onError`) fire automatically on stream completion, eliminating manual tracking code.

```
HTTP Request (POST /api/chat)
       |
       v
+------------------+     +-------------------+
| chatWorkflow()   |---->| streamText()      |
| (orchestrator)   |     | (Vercel AI SDK)   |
+------------------+     +-------------------+
       |                        |
       |                        | onFinish(usage)
       |                        | onError(error)
       v                        v
+------------------+     +-------------------+
| updateMessage()  |     | observability.ts  |
| (status update)  |     | (token tracking)  |
+------------------+     +-------------------+
       |                        |
       v                        v
+------------------+     +-------------------+
| messages table   |     | usage_metrics     |
| (content, status)|     | (tokens, costs)   |
+------------------+     +-------------------+
```

### Design Decisions

**Modular observability over inline callbacks**: Inline callbacks (console.log only) provide no persistence. Modular approach enables database persistence for cost analytics and future webhook integrations (Phase 2).

**Separate usage_metrics table over message metadata**: Message metadata mixes content concerns with analytics. Separate table enables clean SQL aggregations, independent retention policies, and dashboard queries without joining message content.

**onFinish callback over manual tracking**: Manual tracking requires wrapping each stream chunk. SDK's `onFinish` fires automatically with aggregated usage after completion, reducing code and improving reliability.

**Dual error handling (onError + catch)**: `onError` captures LLM-level errors (rate limits, model unavailable). Existing `catch` blocks handle workflow errors (database failures, abort). Full error coverage without conflating error types.

**Token count handling**: Store `inputTokens`, `outputTokens`, and `totalTokens` as-is. `totalTokens` may exceed sum when reasoning tokens are present (Claude Opus extended thinking). All three values stored for accurate billing data.

**CASCADE DELETE for metrics**: When conversation is deleted (privacy compliance), usage metrics also deleted. Sacrifices historical cost analytics for GDPR-style data minimization. Alternative: anonymize conversation_id instead of CASCADE to preserve cost data.

**Indefinite retention**: All usage_metrics retained for historical cost analysis and long-term trend tracking. Storage cost acceptable for analytics value. Future: add archive job if storage becomes concern.

**Structured error logs**: Include timestamp (ISO8601), level (ERROR), context (workflow name), message (error.message), stack (error.stack), and metadata (conversation_id when available). Enables monitoring tool integration (CloudWatch, Sentry). Consistent format across all LLM error paths.

### Observability Invariants

1. **onFinish fires only on successful completion**: Not on abort, not on error.
2. **usage_metrics.message_id is nullable**: Allows tracking usage without binding to specific message.
3. **Token counts stored as-is**: totalTokens may exceed inputTokens + outputTokens (reasoning tokens valid).
4. **Validation: non-negative tokens**: Reject if any token count is negative or null. Accept totalTokens >= inputTokens + outputTokens (reasoning tokens valid).

### Tradeoffs

| Choice | Gain | Cost |
|--------|------|------|
| Separate table | Clean analytics, independent retention | Extra table, extra INSERT per message |
| Property-based tests | Edge case coverage | Longer to write, harder to debug failures |
| Modular observability | Extensible, testable | Extra file, indirection |
