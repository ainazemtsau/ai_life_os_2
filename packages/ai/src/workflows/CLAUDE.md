# Workflows

Mastra workflows for chat, branching, and regeneration with streaming support.

## Index

| File                     | Contents (WHAT)                                           | Read When (WHEN)                              |
| ------------------------ | --------------------------------------------------------- | --------------------------------------------- |
| `README.md`              | Architecture, design decisions, invariants                | Understanding workflow design, status transitions |
| `chat.workflow.ts`       | Chat streaming, message creation, status lifecycle        | Building chat features, debugging streaming   |
| `branch.workflow.ts`     | Message editing, branch creation with sibling messages    | Implementing edit functionality               |
| `regenerate.workflow.ts` | Assistant message regeneration, variant creation          | Adding regeneration, working with variants    |
