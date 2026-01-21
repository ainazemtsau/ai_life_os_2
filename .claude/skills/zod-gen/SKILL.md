---
name: zod-gen
description: Generates Zod schemas from documentation. Use when user asks to generate contracts or sync schemas.
---

# Zod Generation Skill

Generates Zod schemas from README.md domain model descriptions. Maintains sync
between documentation (invisible knowledge) and code (contracts package).

## Activation

Invoke when user requests:
- "generate contracts"
- "sync schemas"
- "create Zod schemas from docs"
- "update contracts from README"

## Workflow

### Phase 1: Discovery

Find README.md files containing domain model descriptions:

```bash
# Find README.md files with domain model sections
grep -rl "## Domain Model\|## Data Model\|## Entities" --include="README.md" .
```

Parse domain model sections looking for:
- Entity names (nouns: User, Chat, Message, Assistant)
- Field descriptions (properties with types)
- Relationships (references to other entities)
- Constraints (required, optional, validation rules)

### Phase 2: Analysis

For each entity found:

1. Check if schema exists in `packages/contracts/src/schemas/`
2. Compare existing schema fields with documented fields
3. Identify:
   - New entities needing schemas
   - Existing schemas needing new fields
   - Documentation updates needed (schema has fields not in docs)

### Phase 3: Generation

For new/updated schemas:

1. Use schema template from `resources/schema-template.md`
2. Generate Zod schema with:
   - z.object() for entities
   - z.string().uuid() for IDs
   - z.string().datetime() for timestamps
   - z.enum() for fixed values
   - z.array() for collections
3. Export type via `z.infer<typeof Schema>`
4. Add to index.ts barrel export

### Phase 4: Verification

After generation:

1. Run `pnpm --filter @ai-life-os/contracts type-check`
2. Run `pnpm --filter @ai-life-os/contracts lint`
3. Run `pnpm --filter @ai-life-os/contracts test`
4. Report any issues for manual resolution

## Output Format

```
## Zod Generation Report

### Scope: [README.md files analyzed]

### Changes Made
- CREATED: [list of new schema files]
- UPDATED: [list of modified schema files]
- SKIPPED: [entities with existing up-to-date schemas]

### Verification
- Type check: [PASS/FAIL]
- Lint: [PASS/FAIL]
- Tests: [PASS/FAIL]
```

## Constraints

- NEVER delete existing schema fields (additive only)
- ALWAYS use z.string().datetime() for timestamps
- ALWAYS export both Schema and inferred Type
- ALWAYS add to index.ts barrel export
- Generated schemas require human review before commit

## Reference

See `resources/schema-template.md` for schema template.
