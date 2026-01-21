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
