# AI Utilities

Tiered AI utility functions system enabling cost-optimized AI operations for conversation management (title generation, future summarization, categorization).

## Architecture

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

## Data Flow

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

## Why This Structure

**packages/ai/src/utilities/** isolates AI logic from UI, enabling reuse across web/CLI/future clients without coupling to React or Next.js.

**Factory pattern** (`createUtility`) centralizes retry/fallback/timeout handling. Each utility only defines prompt + schema, reducing boilerplate and ensuring consistent error handling.

**Tier in utility definition** allows per-function cost/quality optimization. Title generation uses Tier 2 (gpt-5-mini) for balanced cost/quality. Future complex utilities can use Tier 1 (gpt-5) if needed.

**title_edited_at timestamp** tracks manual edits without additional boolean field. NULL check enables simple protection (any manual edit permanently blocks AI updates). Timestamp provides future analytics flexibility.

## Invariants

1. Quick title is ALWAYS set on first message (never null after first message)
2. AI title only overwrites if title_edited_at IS NULL (NULL-only strategy)
3. Fallback chain guarantees title even on API failures (tier 3 → tier 2 → tier 1)
4. Utility functions are pure (input → output), side effects in routes only
5. Title generation triggers only on first message (cost control)

## Tradeoffs

**Quick + AI vs AI only**: Added complexity (two-phase title setting) for better UX. User sees title immediately while AI improves it in background. Tradeoff: more code for instant feedback + quality improvement.

**Registry vs inline**: More files upfront (types, base, per-utility files) for better extensibility. Inline approach would require modifying chat workflow for every new utility. Tradeoff: upfront investment for future payoff.

**3 tiers vs 2**: Extra tier adds configuration but enables fine-grained cost control. Tier 1 (gpt-5) for complex tasks, Tier 2 (gpt-5-mini) for balanced operations, Tier 3 (gpt-5-nano) for simple tasks. Tradeoff: more config for better cost optimization.

**NULL-only edit protection vs time-window**: Simpler implementation (single NULL check vs timestamp comparison + window calculation). Any manual edit permanently blocks AI updates. Tradeoff: less flexibility for clearer UX contract and simpler code.

## Tier Selection

| Tier | Model | Use Case | Cost | Quality |
|------|-------|----------|------|---------|
| 1 | gpt-5 | Complex reasoning, long context | High | Highest |
| 2 | gpt-5-mini | Balanced tasks (title generation) | Medium | Good |
| 3 | gpt-5-nano | Simple tasks, high volume | Low | Acceptable |

Default: Tier 2 (gpt-5-mini)

Fallback chain: Configured tier → Tier 2 → Tier 1 (automatic degradation on failure)

## Adding New Utilities

1. Create utility file in `src/utilities/[name].ts`
2. Define input/output Zod schemas
3. Call `createUtility<TInput, TOutput>({ name, tier, prompt, inputSchema, outputSchema })`
4. Export utility function that calls `.execute(input)`
5. Add API route in `apps/web/app/api/utilities/[name]/route.ts`
6. Export from `src/utilities/index.ts`

Example: Title generator (`title-generator.ts`) demonstrates pattern.
