# Contracts Package

Shared Zod schemas and TypeScript types.

## Files

| File                            | What                           | When to read                               |
| ------------------------------- | ------------------------------ | ------------------------------------------ |
| `package.json`                  | Package config, dependencies   | Modifying build scripts, adding deps       |
| `tsconfig.json`                 | TypeScript config              | Changing compiler options                  |
| `index.ts`                      | Public API barrel export       | Importing contracts                        |
| `src/schemas/chat.schema.ts`    | Chat and ChatMessage schemas   | Working with chat data validation          |
| `src/schemas/assistant.schema.ts` | Assistant schema             | Working with assistant data validation     |
| `src/schemas/index.ts`          | Schema barrel export           | Understanding available schemas            |
| `tests/schemas.test.ts`         | Schema validation tests        | Adding tests, debugging validation         |
| `README.md`                     | Design decisions, invariants   | Understanding schema design rationale      |
