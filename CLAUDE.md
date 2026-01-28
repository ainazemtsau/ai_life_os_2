# AI Life OS

AI-powered chat assistants with memory, tools, and workflows.

## ОБЯЗАТЕЛЬНАЯ ПРОВЕРКА ПЕРЕД "ГОТОВО"

**НИКОГДА не говори что задача выполнена пока не пройдут ВСЕ проверки:**

```bash
# 1. Type check
pnpm type-check

# 2. Lint
pnpm lint

# 3. Build (ловит runtime ошибки экспортов)
pnpm build

# 4. Tests
pnpm test

# 5. Integration tests - проверить что тесты покрывают взаимодействия
# pnpm test запускает все тесты включая integration
```

**Требования к тестам:**
- Integration тесты ДОЛЖНЫ покрывать: API routes + Database, межпакетные взаимодействия
- Unit тесты: property-based (fast-check) для сложной логики
- Если тесты не покрывают взаимодействия - добавить до завершения задачи

## Запуск окружения

**Docker Compose:**

```bash
pnpm start
```

**Проверка что окружение работает:**
- Web App: http://localhost:3000
- Supabase Dashboard: http://localhost:54323

**Другие команды:**
- `pnpm stop` - остановить
- `pnpm logs` - все логи
- `pnpm logs:web` - логи web app

## Files

| File          | What                                           | When to read                                      |
| ------------- | ---------------------------------------------- | ------------------------------------------------- |
| `README.md`   | Architecture, design decisions, invariants     | Understanding system design, tradeoffs, constraints |
| `package.json` | Workspace config, scripts                     | Modifying build/dev/test commands                 |
| `turbo.json`  | Turborepo pipeline config                      | Changing build dependencies, caching              |
| `justfile`    | Task orchestration recipes                     | Running feature workflows, verification tasks     |

## Subdirectories

| Directory         | What                                    | When to read                                      |
| ----------------- | --------------------------------------- | ------------------------------------------------- |
| `apps/web/`       | Next.js 15 chat app                     | Building chat UI, API routes, auth flow           |
| `packages/ai/`    | Mastra agents, workflows, tools         | Creating agents, workflows, prompt engineering    |
| `packages/contracts/` | Shared Zod schemas and types        | Working with data validation, type definitions    |
| `packages/supabase/` | Database client, auth, middleware    | Database operations, auth, session management     |
| `packages/ui/`    | assistant-ui + shadcn components        | Building chat interface, adding UI components     |
| `tooling/`        | Shared ESLint/TypeScript configs        | Modifying linting rules, TypeScript settings      |
| `.claude/`        | Planning workflow, conventions, skills  | Using planner, understanding conventions          |

## Build

```bash
pnpm install
pnpm build
```

## Test

```bash
pnpm test              # All packages
pnpm type-check        # Type checking
pnpm lint              # Linting
```

## Development

```bash
pnpm dev                    # Dev all apps
pnpm dev --filter web       # Dev web only
pnpm db:generate            # Generate Supabase types
```

Stack: Turborepo + pnpm | Next.js 15 | Mastra | assistant-ui | Supabase | shadcn/ui
