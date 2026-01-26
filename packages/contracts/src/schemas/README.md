# Schemas

## Overview

Zod schemas define the contract between API routes, workflows, and database layers. Schemas live in `packages/contracts/` to serve as single source of truth, preventing type drift between layers.

## Design Decisions

**Status Enum on Messages**: Message status tracks generation lifecycle: pending (created, awaiting AI), streaming (receiving chunks), complete (finished), error (API failure), stopped (user aborted). Status enables UI indicators (loading spinners, error states) and resume logic for interrupted streams. Five states cover all spec scenarios without over-engineering.

**Parent ID for Branching**: `Message.parentId` enables tree structure. Edited messages create siblings with same parent. Alternative edges table was rejected for Phase 1 - adds complexity without benefit for simple branching. Parent ID allows recursive queries and matches assistant-ui's mental model.

**Temperature Range 0-2**: OpenAI accepts 0-2, but default is 0.7 (not spec's 1.0). Lower temperature produces more consistent responses for general-purpose chat. Spec's 1.0 default would allow more variation which may confuse users. Range is validated at schema level to prevent invalid API calls.

**Provider Enum**: Assistant schema includes provider enum with 'openai' as only value. This enables future multi-provider support without schema breaking change. Enum will extend to include 'anthropic', 'google', etc. in future phases.

**Optional Max Tokens**: `maxTokens` is optional on Assistant schema. When absent, workflow uses model default (4096). Explicit value overrides default. This matches OpenAI API behavior and simplifies common case.

**Usage Metric Schemas**: `UsageMetricSchema` validates token counts (inputTokens, outputTokens, totalTokens). All three must be non-negative integers. `totalTokens` may exceed sum of input and output when reasoning tokens are present (Claude Opus extended thinking). Schema accepts this as valid per LLM API contract.

**Conversation Usage Aggregation**: `ConversationUsageSchema` aggregates token usage for entire conversation. Includes total input/output/total tokens and message count. Used for cost tracking dashboards and analytics queries.
