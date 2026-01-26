# Queries

Database query functions for messages, conversations, and assistants.

## Index

| File                | Contents (WHAT)                                               | Read When (WHEN)                                  |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| `messages.ts`       | Message CRUD, status transitions, tree traversal, siblings    | Working with message tree, branching, status flow |
| `conversations.ts`  | Conversation CRUD, user conversation listing                  | Thread management, sidebar operations             |
| `assistants.ts`     | Assistant CRUD, user assistant listing                        | Assistant admin panel, configuration updates      |
| `usage-metrics.ts`  | Token usage tracking, conversation aggregation                | Implementing cost analytics, usage dashboards     |
| `index.ts`          | Query exports                                                 | Importing query functions                         |
