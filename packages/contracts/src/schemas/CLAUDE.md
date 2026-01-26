# Schemas

Zod schemas for chat messages, conversations, and assistants.

## Index

| File                  | Contents (WHAT)                                     | Read When (WHEN)                         |
| --------------------- | --------------------------------------------------- | ---------------------------------------- |
| `chat.schema.ts`      | Message, Conversation schemas with status enum      | Working with messages, branching logic   |
| `assistant.schema.ts` | Assistant schema with provider, model, temperature  | Creating assistants, modifying AI config |
| `usage.schema.ts`     | UsageMetric, ConversationUsage schemas with token counts | Working with token tracking, cost analytics |
| `index.ts`            | Schema exports                                      | Importing schemas in other packages      |
| `README.md`           | Schema design decisions                             | Understanding schema rationale           |
