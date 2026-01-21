# Zod Generation Skill

This skill automates the documentation-to-code workflow for Zod schemas.

## Why This Exists

Manual schema maintenance creates drift between documentation (README.md domain
models) and code (packages/contracts/). This skill bridges the gap by reading
documented domain models and generating corresponding Zod schemas.

## Design Decisions

**Additive-only generation**: The skill never deletes existing schema fields.
This prevents accidental data loss and allows schemas to have fields not yet
documented (forward compatibility).

**z.string().datetime() for timestamps**: Chosen over z.date() because JSON
serializes dates as strings. API responses need string validation, not Date
object validation.

**Human review required**: Generated schemas are not auto-committed. The skill
reports what was generated but requires human review before committing. This
catches AI misinterpretations of documentation.

## Workflow Integration

This skill complements doc-sync:
- **doc-sync**: Maintains CLAUDE.md/README.md hierarchy (docs → docs)
- **zod-gen**: Generates contracts from README.md domain models (docs → code)

The two skills form a bidirectional sync:
1. Document domain model in README.md
2. Run zod-gen to generate schemas
3. doc-sync updates CLAUDE.md to reference new contracts
