# AI Package

Mastra agents, workflows, tools, and prompts for chat application.

## Files

| File | What | When to read |
|------|------|--------------|
| `README.md` | Architecture, workflows, invariants | Understanding chat workflow design, status transitions |
| `src/config.ts` | Model configuration, Mastra instance | Changing models, adding providers |
| `src/prompts.ts` | System prompt templates | Modifying assistant behavior |
| `src/index.ts` | Package exports | Finding exported workflows, utilities |

## Subdirectories

| Directory | What | When to read |
|-----------|------|--------------|
| `src/workflows/` | Chat, branch, regenerate workflows | Implementing message handling, streaming |
| `src/operations/` | Message operations (edit, branch logic) | Implementing message manipulation, adding new operations |
| `src/utils/` | Context truncation, retry logic, observability | Handling token limits, API failures, tracking usage |
| `tests/` | Workflow tests | Understanding workflow behavior, edge cases |
