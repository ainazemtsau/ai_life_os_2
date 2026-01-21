ДОПОЛНЕНИЕ К СТЕКУ: Критические находки
1. MASTRA — обязательно добавить сразу
Почему пропустил: Думал использовать "голый" Vercel AI SDK и добавить Mastra позже. Это ОШИБКА.
Факты:

Mastra построена поверх Vercel AI SDK (не альтернатива, а расширение)
795K downloads/week (№2 после Vercel AI SDK)
YC-funded, от создателей Gatsby
Mastra v1 выходит в январе 2026 — идеальный момент начать
Встроенная документация для AI assistants (SKILL.md в node_modules)

Что даёт сразу:

Agent class с памятью и tools
Workflow engine (graph-based, suspend/resume)
Human-in-the-loop из коробки
Tracing и observability встроены
40+ LLM providers через один интерфейс
MCP servers support

Добавить в packages/ai:
@mastra/core
@mastra/ai-sdk

2. ASSISTANT-UI — заменяет кастомные chat components
Что это: React библиотека для AI чатов от YC. 450K+ downloads/month.
Почему важно:

Официальная интеграция с Mastra (документация есть)
Построена на shadcn/ui + Tailwind (совместимо с нашим стеком)
Production-ready: streaming, auto-scroll, markdown, code highlighting, attachments
Generative UI для tool calls
Thread management
Human-in-the-loop approvals

Экономия: 1-2 недели на UI чата
Как использовать:
bashnpx assistant-ui@latest init
```

---

### 3. Финальный стек (исправленный)
```
┌─────────────────────────────────────────────────────────┐
│                    AI Life OS                            │
├─────────────────────────────────────────────────────────┤
│  Monorepo         │  Turborepo + pnpm                   │
├─────────────────────────────────────────────────────────┤
│  Frontend         │  Next.js 15                         │
├─────────────────────────────────────────────────────────┤
│  AI Framework     │  Mastra (включает Vercel AI SDK)    │
├─────────────────────────────────────────────────────────┤
│  Chat UI          │  assistant-ui                       │
├─────────────────────────────────────────────────────────┤
│  Database + Auth  │  Supabase                           │
├─────────────────────────────────────────────────────────┤
│  UI Components    │  shadcn/ui (для не-chat UI)         │
└─────────────────────────────────────────────────────────┘
```

**6 технологий** (не 5):
1. Turborepo
2. Next.js
3. **Mastra** ← добавлено
4. **assistant-ui** ← добавлено
5. Supabase  
6. shadcn/ui

---

### 4. Что рассмотрел и отклонил

| Технология | Почему нет |
|------------|------------|
| **VoltAgent** | Фокус на observability, но Mastra уже имеет tracing. Менее зрелый. |
| **Google ADK** | Только Dec 2025, 5K downloads. Слишком новый. |
| **OpenAI Agents SDK** | Lightweight, но vendor lock-in на OpenAI. |
| **LangChain.js** | Больше downloads, но Python-порт. Mastra native TypeScript. |
| **n8n** | Stateless, для low-code. Не для кастомного продукта. |
| **CopilotKit** | Хорош, но assistant-ui лучше интегрируется с Mastra. |

---

### 5. Архитектурная связка
```
assistant-ui (Chat UI)
      ↓
Mastra (Agents + Workflows)
      ↓
Vercel AI SDK (Streaming + Model routing)
      ↓
Supabase (Storage + Memory + Auth)
```

**Mastra + assistant-ui = первоклассная интеграция** (см. mastra.ai/docs/frameworks/agentic-uis/assistant-ui)

---

### 6. Обновлённые packages
```
packages/
├── ai/                 # Mastra agents, workflows, tools
│   ├── agents/
│   ├── workflows/
│   ├── tools/
│   └── package.json    # @mastra/core, @mastra/ai-sdk
│
├── supabase/           # DB, auth, storage
│
└── ui/                 # assistant-ui + shadcn компоненты
    └── package.json    # @assistant-ui/react