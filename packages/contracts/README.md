# Contracts Package

## Why This Exists

Centralized Zod schemas prevent type drift between packages. All packages import from @ai-life-os/contracts instead of defining their own types.

## Design Decisions

**z.string().datetime() for timestamps**: JSON serializes dates as ISO strings. API responses need string validation, not Date object validation.

**Root index.ts (not src/index.ts)**: Avoids conflict with ESLint boundary rule that blocks `@ai-life-os/*/src/*` imports.

**Additive schemas**: New fields can be added without breaking existing code. Never remove fields without migration.

## Invariants

1. contracts has zero internal dependencies (leaf node in dependency graph)
2. All schemas export both the Zod schema and inferred TypeScript type
3. Timestamps use ISO 8601 string format, not Date objects
