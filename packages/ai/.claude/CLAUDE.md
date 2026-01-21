# @ai-life-os/ai

Mastra agents, workflows, tools, and prompt configuration.

## Index

| File                  | What                                  | When to read                                   |
| --------------------- | ------------------------------------- | ---------------------------------------------- |
| `README.md`           | Architecture decisions, Mastra setup  | Understanding Mastra integration, model strategy |
| `package.json`        | Dependencies, test scripts            | Adding AI dependencies, test setup             |
| `tsconfig.json`       | TypeScript library configuration      | Modifying TypeScript settings                  |
| `vitest.config.ts`    | Vitest test configuration             | Modifying test setup, JSON reporter            |
| `src/index.ts`        | Package exports                       | Understanding public API                       |
| `src/config.ts`       | Mastra instance, model registry       | Adding models, configuring Mastra              |
| `src/prompts.ts`      | System prompts, prompt builders       | Modifying agent behavior, prompt engineering   |
| `tests/config.test.ts` | Property-based tests for AI config   | Writing tests, TDD workflow, understanding edge cases |

## Subdirectories

| Directory        | What                         | When to read                              |
| ---------------- | ---------------------------- | ----------------------------------------- |
| `src/agents/`    | Mastra agent definitions     | Creating agents, modifying agent behavior |
| `src/workflows/` | Mastra workflow definitions  | Creating workflows, orchestrating agents  |
| `src/tools/`     | Agent tools and integrations | Adding tools, external API integrations   |
