# AI Utilities

Tiered AI utility functions for conversation operations.

## Files

| File | What | When to read |
|------|------|--------------|
| `README.md` | Architecture, data flow, invariants, tier selection | Understanding system design, adding new utilities |
| `types.ts` | Type definitions for utilities, tiers, results | Creating new utilities, understanding config structure |
| `tiers.ts` | Model tier registry (gpt-5, gpt-5-mini, gpt-5-nano) | Selecting tier for utility, understanding cost/quality |
| `base.ts` | Utility factory with retry/fallback/timeout | Creating utilities, understanding error handling |
| `title-generator.ts` | Conversation title generation (Tier 2) | Generating titles, understanding title constraints |
| `index.ts` | Utilities package exports | Finding exported utilities, types |
