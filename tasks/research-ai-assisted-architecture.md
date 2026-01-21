# Research: AI-Assisted Development Architecture

## Проблема

Как организовать codebase чтобы:
1. AI code assistants (Claude Code) могли работать **автономно** в изолированных модулях
2. Много агентов могли работать **параллельно** без конфликтов
3. Агенты видели только **public API** других модулей, не внутренности
4. Был **справочный документ** для быстрой навигации по системе
5. Агенты могли **самопроверяться** (тесты, типы, контракты)

---

## Ключевой Insight

> **"Успех зависит от архитектуры, а не от промптов"**

Команды с 3-4x ростом продуктивности инвестировали в модульную структуру, чёткие границы и дисциплинированные workflows — а не в улучшение промптов.

---

## Рекомендуемая Архитектура

### 1. Vertical Slice + Module Manifest

```
ai-life-os/
├── MODULES.md                    # 🔑 Справочник всех модулей (AI читает первым)
├── CLAUDE.md                     # Глобальные правила для AI
│
├── apps/
│   └── web/
│       ├── CLAUDE.md             # Правила для этого модуля
│       ├── MODULE.md             # Описание модуля, public API
│       ├── src/
│       │   ├── features/         # Vertical slices по фичам
│       │   │   ├── chat/
│       │   │   │   ├── index.ts  # Public API фичи
│       │   │   │   ├── components/
│       │   │   │   ├── hooks/
│       │   │   │   └── api/
│       │   │   └── admin/
│       │   └── shared/           # Общие утилиты внутри app
│       └── index.ts
│
├── packages/
│   ├── ai/                       # Mastra agents
│   │   ├── CLAUDE.md
│   │   ├── MODULE.md
│   │   ├── src/
│   │   │   ├── agents/
│   │   │   ├── workflows/
│   │   │   └── tools/
│   │   └── index.ts              # Public API
│   │
│   ├── supabase/                 # Database layer
│   │   ├── CLAUDE.md
│   │   ├── MODULE.md
│   │   ├── src/
│   │   └── index.ts
│   │
│   ├── ui/                       # UI components
│   │   ├── CLAUDE.md
│   │   ├── MODULE.md
│   │   ├── src/
│   │   └── index.ts
│   │
│   └── contracts/                # 🔑 Shared types & schemas
│       ├── src/
│       │   ├── chat.schema.ts    # Zod schemas
│       │   ├── agent.types.ts
│       │   └── index.ts
│       └── package.json
│
└── tooling/
    ├── eslint/
    │   └── module-boundaries.js  # 🔑 Enforce import rules
    └── typescript/
```

---

## 2. Справочный Документ: MODULES.md

Главный файл который AI агент читает **первым** чтобы понять систему:

```markdown
# AI Life OS — Module Registry

> Этот файл — единственный источник истины о модулях системы.
> AI агенты: читайте этот файл перед началом работы.

## Quick Navigation

| Module | Purpose | Public API | Dependencies |
|--------|---------|------------|--------------|
| `@ai-life-os/ai` | Mastra agents, workflows | `packages/ai/index.ts` | contracts |
| `@ai-life-os/supabase` | Database, auth | `packages/supabase/index.ts` | contracts |
| `@ai-life-os/ui` | React components | `packages/ui/index.ts` | contracts |
| `@ai-life-os/contracts` | Shared types | `packages/contracts/index.ts` | - |
| `apps/web` | Next.js application | Internal | ai, supabase, ui |

## Module Dependency Rules

```
contracts ← supabase ← ai
    ↑          ↑        ↑
    └──────────┴────────┴── ui
                            ↑
                          apps/web
```

- `contracts` не зависит ни от кого (leaf node)
- Все модули могут импортировать из `contracts`
- `apps/web` может импортировать из всех packages
- Packages НЕ могут импортировать из `apps/`

## When Working on a Module

1. **Read** `packages/<module>/MODULE.md` first
2. **Import** only from `index.ts` of other packages
3. **Never** import internal files from other packages
4. **Run** `pnpm type-check` after changes

## Module Details

### @ai-life-os/ai
**Location:** `packages/ai/`
**Purpose:** AI agents, workflows, tools using Mastra framework

**Public API:**
```typescript
// Agent creation
export { createAgent, AgentConfig } from './agents';
// Workflows
export { createWorkflow, WorkflowStep } from './workflows';
// Tools
export { weatherTool, calculatorTool } from './tools';
```

**Internal (DO NOT import):**
- `src/agents/internal/*`
- `src/utils/*`

### @ai-life-os/supabase
**Location:** `packages/supabase/`
**Purpose:** Database client, auth, middleware

**Public API:**
```typescript
export { createClient, createServerClient } from './client';
export { authMiddleware } from './middleware';
export type { Database, Tables } from './types';
```

### @ai-life-os/ui
**Location:** `packages/ui/`
**Purpose:** React components (assistant-ui + shadcn)

**Public API:**
```typescript
// Chat components
export { Chat, Message, AssistantMessage } from './chat';
// Base components
export { Button, Input, Card } from './base';
```

### @ai-life-os/contracts
**Location:** `packages/contracts/`
**Purpose:** Shared types and Zod schemas

**Public API:**
```typescript
// Schemas (runtime validation)
export { ChatMessageSchema, AssistantSchema } from './schemas';
// Types (compile-time only)
export type { ChatMessage, Assistant, User } from './types';
```
```

---

## 3. Module Manifest: MODULE.md

Каждый модуль имеет свой `MODULE.md`:

```markdown
# @ai-life-os/ai

> AI агенты и workflows на базе Mastra framework

## For AI Assistants

**Your scope:** Only files in `packages/ai/src/`
**Public API:** `packages/ai/index.ts`
**Can import from:** `@ai-life-os/contracts`
**Cannot import from:** `@ai-life-os/supabase`, `@ai-life-os/ui`, `apps/*`

## Directory Structure

```
src/
├── agents/           # Agent definitions
│   ├── index.ts      # Public exports
│   └── internal/     # ⚠️ Private - do not export
├── workflows/        # Multi-step workflows
├── tools/            # Agent tools
└── index.ts          # Package entry point
```

## Conventions

1. **New agent**: Create in `src/agents/`, export from `src/agents/index.ts`
2. **New workflow**: Create in `src/workflows/`, export from `src/workflows/index.ts`
3. **Shared types**: Import from `@ai-life-os/contracts`, do NOT define local types

## Testing

```bash
pnpm --filter @ai-life-os/ai test
pnpm --filter @ai-life-os/ai type-check
```

## Examples

### Creating an Agent
```typescript
import { createAgent } from './agents';
import { ChatMessageSchema } from '@ai-life-os/contracts';

export const chatAgent = createAgent({
  name: 'chat',
  schema: ChatMessageSchema,
  // ...
});
```
```

---

## 4. CLAUDE.md Иерархия

### Глобальный `CLAUDE.md` (root)

```markdown
# AI Life OS

## 🚨 Before Starting Any Task

1. **Read MODULES.md** — understand module structure
2. **Read MODULE.md** of your target module
3. **Import only from index.ts** of other packages

## Module Boundaries (ENFORCED)

```
✅ import { Button } from '@ai-life-os/ui'
❌ import { Button } from '@ai-life-os/ui/src/components/Button'
```

## Commands

```bash
pnpm dev                    # Dev all
pnpm build                  # Build all
pnpm type-check             # Type check (run after changes!)
pnpm lint                   # Lint (includes module boundary check)
pnpm test:json              # Tests with JSON output
```

## Self-Verification Checklist

Before completing any task:
- [ ] `pnpm type-check` passes
- [ ] `pnpm lint` passes
- [ ] No imports from internal paths of other modules
- [ ] New exports added to index.ts if public
```

### Module-specific `packages/ai/CLAUDE.md`

```markdown
# @ai-life-os/ai — AI Assistant Instructions

## Your Scope
You are working in `packages/ai/`.
- Read `MODULE.md` for structure
- You can only modify files in this directory
- Import shared types from `@ai-life-os/contracts`

## Mastra Patterns

### Agent Definition
```typescript
import { Agent } from '@mastra/core';

export const myAgent = new Agent({
  name: 'my-agent',
  instructions: `...`,
  model: openai('gpt-4o'),
});
```

### Workflow Definition
```typescript
import { Workflow, Step } from '@mastra/core';

export const myWorkflow = new Workflow({
  name: 'my-workflow',
  steps: [step1, step2],
});
```

## Testing
```bash
pnpm --filter @ai-life-os/ai test
```
```

---

## 5. Enforcement: Module Boundaries

### ESLint Rule (рекомендуется)

```javascript
// tooling/eslint/module-boundaries.js
module.exports = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          // Запрет импорта внутренних файлов из других пакетов
          '@ai-life-os/*/src/*',
          '@ai-life-os/*/*/src/*',
          // Разрешён только импорт из index
          '!@ai-life-os/*',
        ],
      },
    ],
  },
};
```

### TypeScript paths (дополнительно)

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "paths": {
      "@ai-life-os/ai": ["packages/ai/src/index.ts"],
      "@ai-life-os/supabase": ["packages/supabase/src/index.ts"],
      "@ai-life-os/ui": ["packages/ui/src/index.ts"],
      "@ai-life-os/contracts": ["packages/contracts/src/index.ts"]
    }
  }
}
```

### Package.json exports field

```json
// packages/ai/package.json
{
  "name": "@ai-life-os/ai",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"]
}
```

---

## 6. Parallel Multi-Agent Development

### Стратегия: Git Worktrees

```bash
# Создание отдельных директорий для каждого агента
git worktree add ../ai-life-os-agent1 -b feature/chat-agent
git worktree add ../ai-life-os-agent2 -b feature/ui-components
git worktree add ../ai-life-os-agent3 -b feature/db-migrations

# Каждый агент работает в своей директории без конфликтов
```

### Claude Code Subagents

```
"Run 4 parallel agents:
- Agent 1: Work on packages/ai/ - implement chat agent
- Agent 2: Work on packages/ui/ - create chat components
- Agent 3: Work on packages/supabase/ - add migrations
- Agent 4: Work on packages/contracts/ - define types

Each agent should:
1. Read MODULES.md first
2. Read their module's MODULE.md
3. Only modify files in their assigned package
4. Run type-check before completing"
```

### Предотвращение конфликтов

| Файл | Владелец | Конфликты |
|------|----------|-----------|
| `packages/contracts/src/types.ts` | Один агент | Высокий риск |
| `packages/ai/src/agents/chat.ts` | Agent 1 | Низкий |
| `packages/ui/src/components/Chat.tsx` | Agent 2 | Низкий |

**Правило:** `packages/contracts/` — один агент в один момент, т.к. это shared dependency.

---

## 7. Self-Verification Pipeline

### Автоматическая проверка

```yaml
# .github/workflows/ai-verification.yml
name: AI Code Verification

on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install
        run: pnpm install

      - name: Type Check
        run: pnpm type-check

      - name: Lint (includes module boundaries)
        run: pnpm lint

      - name: Unit Tests
        run: pnpm test

      - name: Contract Tests
        run: pnpm test:contracts
```

### AI Self-Check Commands

```bash
# В package.json
{
  "scripts": {
    "ai:verify": "pnpm type-check && pnpm lint && pnpm test",
    "ai:verify:module": "pnpm --filter $npm_config_module type-check && pnpm --filter $npm_config_module lint"
  }
}

# AI запускает перед завершением
pnpm ai:verify --module=@ai-life-os/ai
```

---

## 8. Contract Testing

### Zod Schemas в contracts package

```typescript
// packages/contracts/src/chat.schema.ts
import { z } from 'zod';

export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  createdAt: z.date(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const AssistantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  model: z.string(),
  systemPrompt: z.string().optional(),
});

export type Assistant = z.infer<typeof AssistantSchema>;
```

### Runtime Validation

```typescript
// packages/ai/src/agents/chat.ts
import { ChatMessageSchema } from '@ai-life-os/contracts';

export async function handleMessage(input: unknown) {
  // Runtime validation — catches contract violations
  const message = ChatMessageSchema.parse(input);
  // ...
}
```

---

## 9. Рекомендуемый Workflow для AI Life OS

### Фаза 1: Setup (один раз)

1. Создать `MODULES.md` — справочник модулей
2. Создать `MODULE.md` в каждом package
3. Настроить ESLint module boundaries
4. Добавить `pnpm ai:verify` команду

### Фаза 2: Development (каждая фича)

```
1. Plan
   └─ AI читает MODULES.md → понимает структуру
   └─ AI читает MODULE.md целевого модуля
   └─ AI создаёт план в tasks/

2. Execute
   └─ AI работает ТОЛЬКО в своём модуле
   └─ Импортирует из других модулей через public API
   └─ Запускает ai:verify после каждого изменения

3. Verify
   └─ pnpm type-check
   └─ pnpm lint
   └─ pnpm test

4. Commit
   └─ AI коммитит с описанием изменений
```

### Фаза 3: Parallel Development

```
Orchestrator Agent:
├── Reads MODULES.md
├── Decomposes task into module-scoped subtasks
├── Spawns parallel agents:
│   ├── Agent A: packages/contracts/ (first, others depend on it)
│   ├── Agent B: packages/ai/ (waits for contracts)
│   ├── Agent C: packages/ui/ (waits for contracts)
│   └── Agent D: apps/web/ (waits for all packages)
└── Aggregates results, resolves conflicts
```

---

## 10. Итоговая Checklist

### Must Have
- [ ] `MODULES.md` — справочник всех модулей
- [ ] `MODULE.md` в каждом package — scope и public API
- [ ] `CLAUDE.md` иерархия — глобальные + module-specific правила
- [ ] Barrel exports (`index.ts`) — единая точка входа
- [ ] `pnpm ai:verify` — self-check команда
- [ ] ESLint module boundaries — enforcement

### Nice to Have
- [ ] `packages/contracts/` — shared Zod schemas
- [ ] Git worktrees для параллельной работы
- [ ] CI/CD verification pipeline
- [ ] Nx migrate (для enterprise-level boundaries)

---

## References

- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [CLAUDE.md Complete Guide](https://www.builder.io/blog/claude-md-guide)
- [Multi-Agent Parallel Development](https://www.digitalapplied.com/blog/multi-agent-coding-parallel-development)
- [Nx Module Boundaries](https://nx.dev/concepts/module-federation/module-boundaries)
- [Feature-Sliced Design](https://feature-sliced.design/)
- [Addy Osmani AI Coding Workflow](https://addyosmani.com/blog/ai-coding-workflow/)
