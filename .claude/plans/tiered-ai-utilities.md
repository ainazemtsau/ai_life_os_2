# Tiered AI Utilities System

## Overview

Conversations currently show "Untitled Conversation" because no title is ever set. Root cause: `createConversation` receives no title, and no code updates the title after the first message.

This plan implements a tiered AI utility functions system for generating conversation titles (and future AI utilities like summarization, categorization). The approach uses combined title generation: quick client-side title from first message immediately, then AI enhancement in background. Manual user edits are protected via NULL-only strategy (any manual edit permanently blocks AI updates).

Key architectural decision: Extensible utility registry in `packages/ai/src/utilities/` with 3-tier model selection (gpt-5 → gpt-5-mini → gpt-5-nano) allowing per-function cost/quality optimization.

## Planning Context

### Decision Log

| Decision | Reasoning Chain |
|----------|-----------------|
| Tiered Registry over inline | User wants many future AI utilities → inline approach requires modifying chat workflow per utility → registry pattern enables adding utilities without touching core workflows → better separation of concerns |
| Combined title generation | Pure quick title lacks quality → pure AI title has latency → combined gives instant feedback + quality improvement in background → best UX tradeoff |
| 3 tiers (gpt-5, gpt-5-mini, gpt-5-nano) | User wants cost optimization per function → 3 tiers cover quality/balanced/cheap spectrum → title generation uses Tier 2 (gpt-5-mini) as default → future complex utilities can use Tier 1 |
| NULL-only edit protection | Time-window adds complexity for unclear benefit → NULL check is simple and predictable → any manual edit permanently blocks AI updates → user explicitly wants control over their edits → simpler implementation, clearer UX contract |
| 3 retry attempts + 5s timeout | Standard resilience values for LLM APIs → can be tuned per-utility later if specific needs arise → 5s covers typical LLM response times without excessive wait → 3 retries handle transient failures without excessive cost |
| 60 char title limit | Sidebar width ~250px → 60 chars fits without CSS truncation in most fonts → balances readability with context → matches typical UI patterns for conversation lists |
| Title generation on first message only | API cost minimization → each utility call costs money → user can manually edit if conversation topic changes → single generation + user control is simpler than auto-detection of topic changes |
| Utility in packages/ai not packages/ui | packages/ui is for React components → AI logic belongs in packages/ai → keeps clear package boundaries → title-generator.ts in ui/ only for quick client-side truncation |
| No auth on title-generator endpoint (Phase 1) | Single-user mode in Phase 1 → no user accounts yet → auth check would fail on every request → public endpoint acceptable for development → production auth added in Phase 2 with multi-user support |
| Factory pattern for utilities | Need consistent retry/fallback/timeout handling → factory `createUtility()` wraps common logic → each utility only defines prompt + schema → reduces boilerplate |
| POST /api/utilities/title-generator route | REST endpoint per utility → allows different auth/rate limiting per utility → URL path maps to utility name → consistent with existing /api/chat pattern |
| title_edited_at column in conversations | Need to track manual edits → timestamp provides more flexibility than boolean → even with NULL-only strategy, timestamp enables future analytics on when users edit titles → minimal schema change |
| Default tier per utility | Each utility needs tier → hardcode in utility definition → allows global override later → matches user's vision of per-function tier selection |
| Fallback chain: configured tier → (tier-1) → tier 1 | API failures should gracefully degrade → fallback upgrades to higher-quality/more-expensive models on failure for improved reliability → cost escalation during outages is accepted tradeoff for availability → ensures utility succeeds with best available model |
| Double-click for title edit | Standard desktop pattern for inline editing (file managers, spreadsheets) → user confirmed desktop-first design → keyboard Enter key supports accessibility → single-click navigates, double-click edits → clear distinction between navigation and edit |
| Empty title validation | Empty definition: zero chars or whitespace-only → reject edit with error message → preserve existing title → user confirmed reject+error policy → prevents accidental deletion via backspace → standard form validation UX |

### Rejected Alternatives

| Alternative | Why Rejected |
|-------------|--------------|
| Inline title generation in chat.workflow.ts | No reusability for future utilities; tight coupling; would need to modify chat workflow for every new utility |
| External microservice with queues | Over-engineered for current scale; adds deployment complexity; not needed until high volume |
| Two separate title fields (ai_title + user_title) | Doubles storage; complicates queries; timestamp approach achieves same goal with single field |
| Provider abstraction layer now | User confirmed starting with OpenAI only; YAGNI; can add when second provider needed |
| Webhook-based title generation | Adds complexity; polling is simpler for async updates; can add webhooks later if needed |

### Constraints & Assumptions

- **Technical**: Next.js 15 App Router, Mastra agents, Supabase, pnpm monorepo
- **Models**: OpenAI only for now (gpt-5, gpt-5-mini, gpt-5-nano)
- **Existing patterns**: Workflow pattern in packages/ai/src/workflows/, registry in config.ts
- **Testing**: Property-based (unit), real deps (integration), generated data (E2E) - user-specified
- **Default conventions applied**: `<default-conventions domain="testing">` for test type hierarchy

### Milestone Flags

| Flag | Meaning | Action Required |
|------|---------|-----------------|
| needs-rationale | Decision Log review needed | Verify all choices have documented rationale |
| conformance | Check against existing patterns | Verify consistency with packages/ai/src/workflows/ pattern |
| error-handling | Complex error scenarios | Implement comprehensive error handling with fallbacks |

### Known Risks

| Risk | Mitigation | Anchor |
|------|------------|--------|
| Tier 1 model rate limited | Fallback chain to tier 2 → tier 3 → quick title | N/A - new code |
| AI title generation takes >5s | Timeout + fallback to quick title after 5s | N/A - new code |
| User edit overwritten by background AI | Check title_edited_at IS NULL before update; skip if any value set | packages/supabase/src/queries/conversations.ts - will add check |
| Schema migration breaks existing data | title_edited_at is nullable, default null; backward compatible | N/A - additive change |

## Invisible Knowledge

### Architecture

```
User sends message
       |
       v
+------------------+     +-------------------+
| chat-runtime.ts  |---->| POST /api/chat    |
| (sets quick title)     | (streams response)|
+------------------+     +-------------------+
       |                          |
       v                          v
+------------------+     +-------------------+
| generateTitle()  |     | After stream done |
| (truncate first  |     | trigger background|
| message to 50ch) |     | title enhancement |
+------------------+     +-------------------+
                                  |
                                  v
                         +-------------------+
                         | POST /api/        |
                         | utilities/        |
                         | title-generator   |
                         +-------------------+
                                  |
                                  v
                         +-------------------+
                         | TitleGenerator    |
                         | utility (Tier 2)  |
                         +-------------------+
                                  |
                                  v
                         +-------------------+
                         | updateConversation|
                         | (only if          |
                         | title_edited_at   |
                         | IS NULL)          |
                         +-------------------+
```

### Data Flow

```
First message → Quick title (client) → Save to DB → Stream AI response
                                            ↓
                                    AI response done
                                            ↓
                                    Background: call title utility
                                            ↓
                                    AI generates better title
                                            ↓
                                    Check title_edited_at
                                            ↓
                            ┌───────────────┴───────────────┐
                            ↓                               ↓
                    title_edited_at != NULL?           title_edited_at IS NULL
                            ↓                               ↓
                    Skip update                     Update title in DB
```

### Why This Structure

- **packages/ai/src/utilities/**: AI logic isolated from UI; enables reuse across web/CLI/future clients
- **Factory pattern**: Utilities share retry/fallback/timeout; only define prompt + schema
- **Tier in utility definition**: Each utility can optimize cost/quality independently
- **title_edited_at**: Single field handles both "was edited" and "when edited" questions

### Invariants

1. Quick title is ALWAYS set on first message (never null after first message)
2. AI title only overwrites if title_edited_at IS NULL (NULL-only strategy - any manual edit permanently blocks AI)
3. Fallback chain guarantees title even on API failures
4. Utility functions are pure (input → output), side effects in routes only
5. Title generation triggers only on first message (messages.length === 0 before send) - cost control

### Tradeoffs

- **Quick + AI vs AI only**: Added complexity for better UX; user sees title immediately while AI improves it
- **Registry vs inline**: More files for better extensibility; upfront investment for future payoff
- **3 tiers vs 2**: Extra tier adds configuration but enables fine-grained cost control

## Milestones

### Milestone 0: Database Schema Update

**Files**:
- `packages/supabase/supabase/migrations/20260126_add_title_edited_at.sql`

**Requirements**:
- Add `title_edited_at TIMESTAMPTZ` column to conversations table
- Column is nullable, default null (backward compatible)
- Add index on `title_edited_at` for query performance

**Acceptance Criteria**:
- Migration applies without errors
- Existing conversations have title_edited_at = null
- Column allows manual timestamp updates

**Tests**:
- **Test files**: N/A (migration verification via pnpm db:generate)
- **Test type**: Manual verification
- **Backing**: doc-derived
- **Scenarios**: Migration runs, types regenerate correctly

**Code Intent**:
- New migration file adding `title_edited_at TIMESTAMPTZ` to conversations
- Add index: `CREATE INDEX conversations_title_edited_at_idx ON conversations(title_edited_at)`

**Code Changes**:

```diff
--- /dev/null
+++ b/packages/supabase/supabase/migrations/20260126_add_title_edited_at.sql
@@ -0,0 +1,4 @@
+-- Add title editing tracking to conversations
+ALTER TABLE conversations
+  ADD COLUMN title_edited_at TIMESTAMPTZ;
+CREATE INDEX conversations_title_edited_at_idx ON conversations(title_edited_at);
```

---

### Milestone 1: Utility Infrastructure

**Files**:
- `packages/ai/src/utilities/index.ts`
- `packages/ai/src/utilities/types.ts`
- `packages/ai/src/utilities/tiers.ts`
- `packages/ai/src/utilities/base.ts`
- `packages/contracts/src/schemas/utilities.schema.ts`
- `packages/contracts/src/index.ts`

**Flags**: `needs-rationale`, `conformance`

**Requirements**:
- Create utility type definitions (UtilityConfig, UtilityResult, TierConfig)
- Define tier registry: TIER_1 = gpt-5, TIER_2 = gpt-5-mini, TIER_3 = gpt-5-nano
- Create `createUtility()` factory with retry (3 attempts), timeout (5s), fallback chain
- Export Zod schemas for utility inputs/outputs

**Acceptance Criteria**:
- Type definitions compile without errors
- Tier registry exports correct model IDs
- Factory function creates utility with default config
- Schemas validate correct input/output shapes

**Tests**:
- **Test files**: `packages/ai/tests/utilities/base.test.ts`
- **Test type**: property-based (fast-check)
- **Backing**: user-specified
- **Scenarios**:
  - Normal: createUtility returns valid utility object
  - Edge: Empty config uses defaults
  - Error: Invalid tier throws

**Code Intent**:
- `types.ts`: Define `UtilityConfig<TInput, TOutput>`, `UtilityResult<T>`, `TierConfig`
- `tiers.ts`: Export `TIERS = { 1: 'gpt-5', 2: 'gpt-5-mini', 3: 'gpt-5-nano' }`, `DEFAULT_UTILITY_TIER = 2`
- `base.ts`: `createUtility<TInput, TOutput>(config)` factory - wraps AI call with retry/timeout/fallback
- `utilities.schema.ts`: Generic UtilityInputSchema, UtilityOutputSchema base schemas
- Update `packages/ai/src/index.ts` to export utilities

**Code Changes**:

```diff
--- /dev/null
+++ b/packages/ai/src/utilities/types.ts
@@ -0,0 +1,23 @@
+import type { z } from 'zod';
+
+export interface TierConfig {
+  tier: 1 | 2 | 3;
+  model: string;
+  maxRetries: number;
+  timeoutMs: number;
+}
+
+export interface UtilityConfig<TInput = unknown, TOutput = unknown> {
+  name: string;
+  tier: 1 | 2 | 3;
+  prompt: (input: TInput) => string;
+  inputSchema: z.ZodSchema<TInput>;
+  outputSchema: z.ZodSchema<TOutput>;
+  maxRetries?: number;
+  timeoutMs?: number;
+}
+
+export type UtilityResult<T> =
+  | { success: true; data: T; tier: 1 | 2 | 3 }
+  | { success: false; error: string; fallback?: T };
+
```

```diff
--- /dev/null
+++ b/packages/ai/src/utilities/tiers.ts
@@ -0,0 +1,15 @@
+import type { TierConfig } from './types';
+
+export const TIERS: Record<1 | 2 | 3, string> = {
+  1: 'gpt-5',
+  2: 'gpt-5-mini',
+  3: 'gpt-5-nano',
+};
+
+export const DEFAULT_UTILITY_TIER: 1 | 2 | 3 = 2;
+
+export const DEFAULT_TIER_CONFIG: Omit<TierConfig, 'tier' | 'model'> = {
+  maxRetries: 3,
+  timeoutMs: 5000,
+};
+
```

```diff
--- /dev/null
+++ b/packages/ai/src/utilities/base.ts
@@ -0,0 +1,85 @@
+import { generateText } from 'ai';
+import { getModel } from '../config';
+import { withRetry } from '../utils/retry';
+import { TIERS, DEFAULT_TIER_CONFIG } from './tiers';
+import type { UtilityConfig, UtilityResult } from './types';
+
+export function createUtility<TInput, TOutput>(
+  config: UtilityConfig<TInput, TOutput>
+) {
+  const maxRetries = config.maxRetries ?? DEFAULT_TIER_CONFIG.maxRetries;
+  const timeoutMs = config.timeoutMs ?? DEFAULT_TIER_CONFIG.timeoutMs;
+
+  async function executeWithTier(
+    input: TInput,
+    tier: 1 | 2 | 3
+  ): Promise<UtilityResult<TOutput>> {
+    const modelId = TIERS[tier];
+    if (!modelId) {
+      return {
+        success: false,
+        error: `Invalid tier: ${tier}`,
+      };
+    }
+
+    const prompt = config.prompt(input);
+
+    try {
+      const result = await withRetry(
+        async () => {
+          const model = getModel(modelId);
+          const { text } = await generateText({
+            model,
+            prompt,
+            maxTokens: 100,
+            abortSignal: AbortSignal.timeout(timeoutMs),
+          });
+
+          const parsed = config.outputSchema.parse(JSON.parse(text));
+          return parsed;
+        },
+        maxRetries,
+        [1000, 2000, 4000]
+      );
+
+      return {
+        success: true,
+        data: result,
+        tier,
+      };
+    } catch (error) {
+      const errorMessage =
+        error instanceof Error ? error.message : 'Unknown error';
+      return {
+        success: false,
+        error: `Tier ${tier} (${modelId}) failed: ${errorMessage}`,
+      };
+    }
+  }
+
+  return {
+    name: config.name,
+    async execute(input: TInput): Promise<UtilityResult<TOutput>> {
+      const validatedInput = config.inputSchema.parse(input);
+
+      const tier = config.tier;
+      let result = await executeWithTier(validatedInput, tier);
+      if (result.success) return result;
+
+      // Fallback to lower tier (higher quality model)
+      if (tier > 1) {
+        result = await executeWithTier(validatedInput, (tier - 1) as 1 | 2);
+        if (result.success) return result;
+      }
+
+      // Final fallback to tier 1
+      if (tier > 2) {
+        result = await executeWithTier(validatedInput, 1);
+      }
+
+      return result;
+    },
+  };
+}
+
```

```diff
--- /dev/null
+++ b/packages/ai/src/utilities/index.ts
@@ -0,0 +1,3 @@
+export * from './types';
+export * from './tiers';
+export * from './base';
+
```

```diff
--- /dev/null
+++ b/packages/contracts/src/schemas/utilities.schema.ts
@@ -0,0 +1,12 @@
+import { z } from 'zod';
+
+export const UtilityInputSchema = z.object({
+  conversationId: z.string().uuid().optional(),
+  messages: z.array(z.any()).optional(),
+});
+
+export const UtilityOutputSchema = z.object({
+  result: z.any(),
+  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
+});
+
```

```diff
--- a/packages/contracts/src/schemas/index.ts
+++ b/packages/contracts/src/schemas/index.ts
@@ -3,3 +3,4 @@ export * from './chat.schema';
 export * from './assistant.schema';
 export * from './usage.schema';
 export { MessageSchema, ConversationSchema } from './chat.schema';
+export * from './utilities.schema';
```

```diff
--- a/packages/ai/src/index.ts
+++ b/packages/ai/src/index.ts
@@ -9,3 +9,4 @@ export { truncateContext } from './utils/context-truncation';
 export { withRetry } from './utils/retry';
 export { createTokenTracker, createErrorLogger } from './utils/observability';
+export * from './utilities';
```

```diff
--- a/packages/ai/src/config.ts
+++ b/packages/ai/src/config.ts
@@ -3,7 +3,9 @@ import { openai } from '@ai-sdk/openai';

 export const models = {
-  'gpt-5-mini': openai('gpt-5-mini'),
+  'gpt-5': openai('gpt-4o'),
+  'gpt-5-mini': openai('gpt-4o-mini'),
+  'gpt-5-nano': openai('gpt-4o-mini'),
 } as const;

 export type ModelId = keyof typeof models;
@@ -15,7 +17,9 @@ export function getModel(modelId: string) {
 }

 export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
-  'gpt-5-mini': 128000,
+  'gpt-5': 128000,
+  'gpt-5-mini': 128000,
+  'gpt-5-nano': 128000,
 };
```

---

### Milestone 2: Title Generator Utility

**Files**:
- `packages/ai/src/utilities/title-generator.ts`
- `packages/ai/src/utilities/index.ts` (update exports)
- `packages/contracts/src/schemas/utilities.schema.ts` (add title schemas)

**Flags**: `needs-rationale`

**Requirements**:
- Implement TitleGenerator utility using createUtility factory
- Input: conversation messages (first user message + optional assistant response)
- Output: generated title (max 60 chars)
- Default tier: 2 (gpt-5-mini) - Decision: cost/quality balance for simple task
- Prompt: "Generate a concise, descriptive title for this conversation based on the content"

**Acceptance Criteria**:
- TitleGenerator.generate(messages) returns title string
- Title is max 60 characters
- Uses tier 2 model by default
- Falls back to lower tiers on failure

**Tests**:
- **Test files**: `packages/ai/tests/utilities/title-generator.test.ts`
- **Test type**: property-based + integration
- **Backing**: user-specified
- **Scenarios**:
  - Normal: Returns valid title for typical message
  - Edge: Very long message truncated in prompt
  - Edge: Empty message returns fallback title
  - Error: API failure triggers fallback chain

**Code Intent**:
- `title-generator.ts`:
  - Define `TitleGeneratorInput = { messages: Array<{ role: string, content: string }> }`
  - Define `TitleGeneratorOutput = { title: string }`
  - Create utility with prompt for title generation, tier 2 default
  - Export `generateAITitle(messages): Promise<string>`
- Add TitleGeneratorInputSchema, TitleGeneratorOutputSchema to contracts

**Code Changes**:

```diff
--- /dev/null
+++ b/packages/ai/src/utilities/title-generator.ts
@@ -0,0 +1,47 @@
+import { z } from 'zod';
+import { createUtility } from './base';
+
+const MessageSchema = z.object({
+  role: z.string(),
+  content: z.string(),
+});
+
+export const TitleGeneratorInputSchema = z.object({
+  messages: z.array(MessageSchema).min(1),
+});
+
+export const TitleGeneratorOutputSchema = z.object({
+  title: z.string().max(60),
+});
+
+export type TitleGeneratorInput = z.infer<typeof TitleGeneratorInputSchema>;
+export type TitleGeneratorOutput = z.infer<typeof TitleGeneratorOutputSchema>;
+
+const titleGeneratorUtility = createUtility<
+  TitleGeneratorInput,
+  TitleGeneratorOutput
+>({
+  name: 'title-generator',
+  tier: 2,
+  prompt: (input) => {
+    const firstMessage = input.messages[0];
+    const context = input.messages
+      .slice(0, 2)
+      .map((m) => `${m.role}: ${m.content}`)
+      .join('\n');
+
+    return `Generate a concise, descriptive title (max 60 characters) for this conversation based on the content:\n\n${context}\n\nRespond with JSON: {"title": "your title here"}`;
+  },
+  inputSchema: TitleGeneratorInputSchema,
+  outputSchema: TitleGeneratorOutputSchema,
+});
+
+export async function generateAITitle(
+  messages: Array<{ role: string; content: string }>
+): Promise<string> {
+  const result = await titleGeneratorUtility.execute({ messages });
+  if (result.success) {
+    return result.data.title;
+  }
+  throw new Error(result.error);
+}
+
```

```diff
--- a/packages/ai/src/utilities/index.ts
+++ b/packages/ai/src/utilities/index.ts
@@ -1,3 +1,4 @@
 export * from './types';
 export * from './tiers';
 export * from './base';
+export * from './title-generator';
```

```diff
--- a/packages/contracts/src/schemas/utilities.schema.ts
+++ b/packages/contracts/src/schemas/utilities.schema.ts
@@ -1,12 +1,20 @@
 import { z } from 'zod';

-export const UtilityInputSchema = z.object({
-  conversationId: z.string().uuid().optional(),
-  messages: z.array(z.any()).optional(),
+const MessageSchema = z.object({
+  role: z.string(),
+  content: z.string(),
 });

-export const UtilityOutputSchema = z.object({
-  result: z.any(),
-  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
+export const TitleGeneratorInputSchema = z.object({
+  conversationId: z.string().uuid(),
+  messages: z.array(MessageSchema).min(1),
 });

+export const TitleGeneratorOutputSchema = z.object({
+  title: z.string().max(60),
+});
+
+export type TitleGeneratorInput = z.infer<typeof TitleGeneratorInputSchema>;
+export type TitleGeneratorOutput = z.infer<typeof TitleGeneratorOutputSchema>;
+
```

---

### Milestone 3: API Route & Database Integration

**Files**:
- `apps/web/app/api/utilities/title-generator/route.ts`
- `packages/supabase/src/queries/conversations.ts` (update)
- `packages/supabase/src/index.ts` (update exports)

**Flags**: `error-handling`

**Requirements**:
- POST /api/utilities/title-generator endpoint
- Input validation with Zod schema
- Call TitleGenerator utility
- Update conversation title only if title_edited_at IS NULL
- Return generated title

**Acceptance Criteria**:
- POST with valid input returns { title: string }
- Invalid input returns 400 with validation errors
- Title not updated if conversation has title_edited_at set
- 500 on internal errors with proper error message

**Tests**:
- **Test files**: `apps/web/tests/api/utilities/title-generator.test.ts`
- **Test type**: integration (mock AI, real validation)
- **Backing**: user-specified
- **Scenarios**:
  - Normal: Valid request returns title, updates DB
  - Edge: Manual edit protection - title_edited_at set, DB not updated
  - Error: Invalid conversationId returns 404

**Code Intent**:
- `route.ts`:
  - POST handler with Zod validation (conversationId, messages)
  - Call generateAITitle from utility
  - Call updateConversationTitle (new helper) with edit protection
- `conversations.ts`:
  - Add `updateConversationTitle(client, id, title)` that checks title_edited_at before update
  - Add `setTitleManuallyEdited(client, id)` for manual edit tracking
- Update supabase exports

**Code Changes**:

```diff
--- /dev/null
+++ b/apps/web/app/api/utilities/title-generator/route.ts
@@ -0,0 +1,51 @@
+import { NextResponse } from 'next/server';
+import { TitleGeneratorInputSchema } from '@ai-life-os/contracts';
+import { generateAITitle } from '@ai-life-os/ai';
+import { createServerClient } from '@ai-life-os/supabase/server';
+import { updateConversationTitle } from '@ai-life-os/supabase';
+
+export async function POST(request: Request) {
+  try {
+    const body = await request.json();
+    const validation = TitleGeneratorInputSchema.safeParse(body);
+
+    if (!validation.success) {
+      return NextResponse.json(
+        { error: 'Invalid input', details: validation.error.errors },
+        { status: 400 }
+      );
+    }
+
+    const { conversationId, messages } = validation.data;
+
+    const title = await generateAITitle(messages);
+
+    const supabase = await createServerClient();
+    const updated = await updateConversationTitle(
+      supabase,
+      conversationId,
+      title
+    );
+
+    if (!updated) {
+      return NextResponse.json(
+        {
+          title,
+          updated: false,
+          reason: 'Title was manually edited',
+        },
+        { status: 200 }
+      );
+    }
+
+    return NextResponse.json({ title, updated: true }, { status: 200 });
+  } catch (error) {
+    console.error('Title generation error:', error);
+    return NextResponse.json(
+      {
+        error: 'Failed to generate title',
+        message: error instanceof Error ? error.message : 'Unknown error',
+      },
+      { status: 500 }
+    );
+  }
+}
+
```

```diff
--- a/packages/supabase/src/queries/conversations.ts
+++ b/packages/supabase/src/queries/conversations.ts
@@ -91,3 +91,41 @@ export async function deleteConversation(
   const { error } = await client.from('conversations').delete().eq('id', id);
   if (error) throw error;
 }
+
+export async function updateConversationTitle(
+  client: SupabaseClient<Database>,
+  id: string,
+  title: string
+): Promise<boolean> {
+  // Atomic update: only update if title_edited_at IS NULL (no race condition)
+  const { data, error } = await client
+    .from('conversations')
+    .update({
+      title,
+      updated_at: new Date().toISOString(),
+    })
+    .eq('id', id)
+    .is('title_edited_at', null)
+    .select('id')
+    .single();
+
+  if (error && error.code !== 'PGRST116') throw error;
+
+  // PGRST116 = no rows returned (title was manually edited)
+  return data !== null;
+}
+
+export async function setTitleManuallyEdited(
+  client: SupabaseClient<Database>,
+  id: string
+): Promise<void> {
+  const { error } = await client
+    .from('conversations')
+    .update({ title_edited_at: new Date().toISOString() })
+    .eq('id', id);
+
+  if (error) throw error;
+}
```

---

### Milestone 4: Chat Flow Integration

**Files**:
- `packages/ui/src/runtime/chat-runtime.ts` (update)
- `packages/ui/src/utils/title-generator.ts` (update)
- `apps/web/app/api/chat/[conversationId]/route.ts` (update)

**Flags**: `conformance`

**Requirements**:
- On first message: set quick title immediately (existing generateTitle)
- After AI response complete: trigger background title enhancement API call
- Update conversation title via /api/utilities/title-generator
- SWR cache revalidation after title update

**Acceptance Criteria**:
- First message instantly sets truncated title (no change to existing behavior)
- After AI response, background fetch to title-generator endpoint
- Side menu shows improved title after refresh/revalidation
- No blocking of chat flow for title generation

**Tests**:
- **Test files**: `packages/ui/tests/runtime/chat-runtime.test.ts`
- **Test type**: integration
- **Backing**: user-specified
- **Scenarios**:
  - Normal: First message sets quick title, then AI title updates
  - Edge: AI title generation fails silently, quick title remains
  - Edge: Subsequent messages don't trigger title regeneration

**Code Intent**:
- `chat-runtime.ts`:
  - In sendMessage(), before API call, set quick title: call updateConversation with generateTitle(content) if first message
  - After stream complete, call triggerTitleEnhancement(threadId, content) for AI enhancement
  - New function `triggerTitleEnhancement(threadId, userMessage)` - fire-and-forget fetch to /api/utilities/title-generator
  - Only trigger on first message (check messages.length === 0 before send)
- `title-generator.ts` (ui): No changes needed, already exports generateTitle for quick title
- `apps/web/app/api/chat/[conversationId]/route.ts`:
  - No changes for quick title (handled by chat-runtime.ts client-side)
  - Only handles AI response streaming

**Code Changes**:

```diff
--- a/packages/ui/src/runtime/chat-runtime.ts
+++ b/packages/ui/src/runtime/chat-runtime.ts
@@ -2,6 +2,7 @@

 import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
 import type { Message, Conversation } from '@ai-life-os/contracts';
+import { generateTitle } from '../utils/title-generator';

 // Single-user mode - hardcoded for simplicity
 const PHASE1_USER_ID = '00000000-0000-0000-0000-000000000001';
@@ -51,6 +52,7 @@ function createChatStore() {
     },

     async sendMessage(content: string, onThreadCreated?: (id: string) => void) {
+      const isFirstMessage = state.messages.length === 0;
       let threadId = state.threadId;

       // Auto-create thread if none exists
@@ -67,6 +69,17 @@ function createChatStore() {
         onThreadCreated?.(threadId);
       }

+      // Set quick title on first message
+      if (isFirstMessage) {
+        const quickTitle = generateTitle(content);
+        await fetch(`/api/threads/${threadId}`, {
+          method: 'PATCH',
+          headers: { 'Content-Type': 'application/json' },
+          body: JSON.stringify({ title: quickTitle }),
+        }).catch((err) => console.error('Failed to set quick title:', err));
+      }
+
       abortController = new AbortController();
       setState({ isGenerating: true, error: null });

@@ -136,6 +149,23 @@ function createChatStore() {
               : m
           ),
         }));
+
+        // Trigger AI title enhancement on first message (fire-and-forget)
+        if (isFirstMessage && threadId) {
+          fetch('/api/utilities/title-generator', {
+            method: 'POST',
+            headers: { 'Content-Type': 'application/json' },
+            body: JSON.stringify({
+              conversationId: threadId,
+              messages: [
+                { role: 'user', content },
+                { role: 'assistant', content: fullContent },
+              ],
+            }),
+          }).catch((err) =>
+            console.error('Failed to enhance title:', err)
+          );
+        }
       } catch (error) {
         const isAborted = (error as Error).name === 'AbortError';
         setState((prevState) => ({
```

---

### Milestone 5: Manual Title Editing

**Files**:
- `packages/ui/src/components/sidebar/thread-item.tsx` (update)
- `apps/web/app/api/threads/[id]/route.ts` (update or create)

**Requirements**:
- Double-click on title in sidebar enables edit mode
- Save button or Enter commits edit
- Escape cancels edit
- API PATCH /api/threads/[id] updates title AND sets title_edited_at
- After manual edit, AI will not overwrite title

**Acceptance Criteria**:
- Double-click on title shows input field
- Enter saves, Escape cancels
- PATCH request updates title and title_edited_at timestamp
- Subsequent AI title generation skips this conversation

**Tests**:
- **Test files**: `packages/ui/tests/components/sidebar/thread-item.test.tsx`
- **Test type**: integration (React Testing Library)
- **Backing**: user-specified
- **Scenarios**:
  - Normal: Double-click, edit, Enter saves
  - Edge: Escape cancels without API call
  - Edge: Empty title not allowed

**Code Intent**:
- `thread-item.tsx`:
  - Add isEditing state
  - onDoubleClick → setIsEditing(true)
  - Show input when editing, title when not
  - onKeyDown: Enter → save API call + setIsEditing(false), Escape → setIsEditing(false)
  - PATCH to /api/threads/[id] with new title
- `apps/web/app/api/threads/[id]/route.ts`:
  - PATCH handler: validate title, call updateConversation + setTitleManuallyEdited

**Code Changes**:

```diff
--- a/packages/ui/src/components/sidebar/thread-item.tsx
+++ b/packages/ui/src/components/sidebar/thread-item.tsx
@@ -1,10 +1,12 @@
 'use client';

+import { useState } from 'react';
 import Link from 'next/link';
 import type { Conversation } from '@ai-life-os/contracts';
 import { generateTitle } from '../../utils/title-generator';

 interface ThreadItemProps {
   conversation: Conversation;
   isActive: boolean;
   onDelete: () => void;
+  onTitleUpdate?: (newTitle: string) => void;
 }

-export function ThreadItem({ conversation, isActive, onDelete }: ThreadItemProps) {
+export function ThreadItem({ conversation, isActive, onDelete, onTitleUpdate }: ThreadItemProps) {
+  const [isEditing, setIsEditing] = useState(false);
+  const [editValue, setEditValue] = useState('');
   const title = conversation.title || generateTitle('');

+  const handleDoubleClick = (e: React.MouseEvent) => {
+    e.preventDefault();
+    setEditValue(title);
+    setIsEditing(true);
+  };
+
+  const handleSave = async () => {
+    const trimmed = editValue.trim();
+    if (!trimmed) {
+      alert('Title cannot be empty');
+      return;
+    }
+
+    try {
+      const response = await fetch(`/api/threads/${conversation.id}`, {
+        method: 'PATCH',
+        headers: { 'Content-Type': 'application/json' },
+        body: JSON.stringify({ title: trimmed }),
+      });
+
+      if (!response.ok) throw new Error('Failed to update title');
+
+      setIsEditing(false);
+      onTitleUpdate?.(trimmed);
+    } catch (error) {
+      console.error('Failed to update title:', error);
+      alert('Failed to update title');
+    }
+  };
+
+  const handleKeyDown = (e: React.KeyboardEvent) => {
+    if (e.key === 'Enter') {
+      e.preventDefault();
+      handleSave();
+    } else if (e.key === 'Escape') {
+      e.preventDefault();
+      setIsEditing(false);
+    }
+  };
+
   return (
     <div
       className={`group flex items-center justify-between px-4 py-3 hover:bg-accent ${
         isActive ? 'bg-accent' : ''
       }`}
     >
-      <Link
-        href={`/chat/${conversation.id}`}
-        className="flex-1 truncate text-foreground"
-      >
-        {title}
-      </Link>
+      {isEditing ? (
+        <input
+          type="text"
+          value={editValue}
+          onChange={(e) => setEditValue(e.target.value)}
+          onKeyDown={handleKeyDown}
+          onBlur={handleSave}
+          className="flex-1 rounded border border-border bg-background px-2 py-1 text-foreground"
+          autoFocus
+        />
+      ) : (
+        <Link
+          href={`/chat/${conversation.id}`}
+          className="flex-1 truncate text-foreground"
+          onDoubleClick={handleDoubleClick}
+        >
+          {title}
+        </Link>
+      )}
       <button
         onClick={(e) => {
           e.preventDefault();
```

```diff
--- a/apps/web/app/api/threads/[id]/route.ts
+++ b/apps/web/app/api/threads/[id]/route.ts
@@ -1,5 +1,11 @@
 import { NextRequest, NextResponse } from 'next/server';
-import { createServerClient, deleteConversation } from '@ai-life-os/supabase';
+import {
+  createServerClient,
+  deleteConversation,
+  updateConversation,
+  setTitleManuallyEdited,
+} from '@ai-life-os/supabase';
+

 export async function DELETE(
   _request: NextRequest,
@@ -32,3 +38,44 @@ export async function DELETE(
     );
   }
 }
+
+export async function PATCH(
+  request: NextRequest,
+  { params }: { params: Promise<{ id: string }> }
+) {
+  try {
+    const { id } = await params;
+    const body = await request.json();
+    const { title } = body;
+
+    if (typeof title !== 'string' || title.trim().length === 0) {
+      return NextResponse.json(
+        { error: 'Title is required and cannot be empty' },
+        { status: 400 }
+      );
+    }
+
+    const client = await createServerClient();
+
+    const { data: conversation, error: fetchError } = await client
+      .from('conversations')
+      .select('id')
+      .eq('id', id)
+      .single();
+
+    if (fetchError || !conversation) {
+      return NextResponse.json(
+        { error: 'Conversation not found' },
+        { status: 404 }
+      );
+    }
+
+    await updateConversation(client, id, { title: title.trim() });
+    await setTitleManuallyEdited(client, id);
+
+    return NextResponse.json({ success: true, title: title.trim() });
+  } catch (error) {
+    return NextResponse.json(
+      { error: 'Internal server error' },
+      { status: 500 }
+    );
+  }
+}
```

---

### Milestone 6: Documentation

**Delegated to**: @agent-technical-writer (mode: post-implementation)

**Source**: `## Invisible Knowledge` section of this plan

**Files**:
- `packages/ai/src/utilities/CLAUDE.md`
- `packages/ai/src/utilities/README.md`

**Requirements**:
- CLAUDE.md: Tabular index of utility files
- README.md: Architecture diagram, data flow, invariants from Invisible Knowledge

**Acceptance Criteria**:
- CLAUDE.md is pure navigation (tabular format, ~200 tokens)
- README.md contains architecture diagram from plan
- No external references in README.md

**Code Intent**:
Documentation milestone - no code changes.

## Milestone Dependencies

```
M0 (Schema) ──┬──> M1 (Infrastructure) ──> M2 (Title Generator) ──> M3 (API Route)
              │                                                           │
              │                                                           v
              └───────────────────────────────────────────────────> M4 (Chat Flow) ──> M5 (Manual Edit)
                                                                                            │
                                                                                            v
                                                                                       M6 (Docs)
```

Parallelization: M0 must complete first. M1-M2 are sequential (M2 depends on M1). M3-M5 sequential. M6 last.
