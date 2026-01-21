# AI Life OS — Финальный стек

## Стек

```
┌─────────────────────────────────────────────────────────┐
│                    AI Life OS                            │
├─────────────────────────────────────────────────────────┤
│  Monorepo         │  Turborepo + pnpm                   │
├─────────────────────────────────────────────────────────┤
│  Frontend + API   │  Next.js 15 (App Router)            │
├─────────────────────────────────────────────────────────┤
│  AI               │  Vercel AI SDK                      │
├─────────────────────────────────────────────────────────┤
│  Database + Auth  │  Supabase                           │
│  + Realtime       │  (PostgreSQL под капотом)           │
├─────────────────────────────────────────────────────────┤
│  UI               │  Tailwind + shadcn/ui               │
├─────────────────────────────────────────────────────────┤
│  Язык             │  TypeScript (strict)                │
└─────────────────────────────────────────────────────────┘
```

---

## Почему Turborepo сразу

| Сейчас | Потом (миграция) |
|--------|------------------|
| 5 минут на setup | 1-2 дня переписывать импорты |
| Структура готова к росту | Боль с path aliases |
| packages/ai ждёт Mastra | Ломать работающий код |

**Overhead:** только структура папок + 2 конфиг файла.

---

## Структура проекта

```
ai-life-os/
├── apps/
│   └── web/                        # Next.js приложение
│       ├── app/
│       │   ├── (auth)/
│       │   │   ├── login/page.tsx
│       │   │   └── register/page.tsx
│       │   ├── (chat)/
│       │   │   ├── page.tsx                # Список чатов
│       │   │   └── [chatId]/page.tsx       # Чат
│       │   ├── (admin)/
│       │   │   ├── layout.tsx              # Admin layout
│       │   │   ├── page.tsx                # Dashboard
│       │   │   └── assistants/
│       │   │       ├── page.tsx            # Список
│       │   │       ├── new/page.tsx        # Создать
│       │   │       └── [id]/page.tsx       # Редактировать
│       │   ├── api/
│       │   │   └── chat/route.ts           # AI streaming endpoint
│       │   └── layout.tsx
│       ├── components/
│       │   ├── chat/
│       │   │   ├── chat-input.tsx
│       │   │   ├── chat-messages.tsx
│       │   │   └── message-bubble.tsx
│       │   └── admin/
│       │       ├── assistant-form.tsx
│       │       └── assistant-card.tsx
│       ├── package.json
│       ├── tailwind.config.ts
│       └── tsconfig.json
│
├── packages/
│   ├── supabase/                   # Database layer
│   │   ├── src/
│   │   │   ├── client.ts           # Browser client
│   │   │   ├── server.ts           # Server client
│   │   │   ├── middleware.ts       # Auth middleware
│   │   │   ├── types.ts            # Generated DB types
│   │   │   └── index.ts            # Exports
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ai/                         # AI logic (Phase 4+ Mastra)
│   │   ├── src/
│   │   │   ├── config.ts           # Provider configs
│   │   │   ├── prompts.ts          # System prompts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── ui/                         # Shared UI components
│       ├── src/
│       │   ├── button.tsx
│       │   ├── input.tsx
│       │   ├── card.tsx
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── tooling/
│   ├── eslint/                     # Shared ESLint config
│   │   ├── base.js
│   │   └── package.json
│   └── typescript/                 # Shared TS config
│       ├── base.json
│       ├── nextjs.json
│       └── package.json
│
├── turbo.json                      # Turborepo config
├── pnpm-workspace.yaml             # Workspace definition
├── package.json                    # Root package.json
└── .env                            # Environment variables
```

---

## Конфигурационные файлы

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "type-check": {
      "dependsOn": ["^build"]
    }
  }
}
```

### pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tooling/*"
```

### Root package.json

```json
{
  "name": "ai-life-os",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "type-check": "turbo type-check",
    "db:generate": "pnpm --filter @ai-life-os/supabase generate"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.7.0"
  },
  "packageManager": "pnpm@9.15.0"
}
```

### apps/web/package.json

```json
{
  "name": "@ai-life-os/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@ai-life-os/supabase": "workspace:*",
    "@ai-life-os/ai": "workspace:*",
    "@ai-life-os/ui": "workspace:*",
    "ai": "^4.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.7.0"
  }
}
```

### packages/supabase/package.json

```json
{
  "name": "@ai-life-os/supabase",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "generate": "supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/types.ts",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.47.0",
    "@supabase/ssr": "^0.5.0"
  },
  "devDependencies": {
    "supabase": "^2.0.0",
    "typescript": "^5.7.0"
  }
}
```

---

## Package: @ai-life-os/supabase

### src/client.ts

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### src/server.ts

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — ignore
          }
        },
      },
    }
  )
}
```

### src/middleware.ts

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => 
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protect routes
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

### src/index.ts

```typescript
export { createClient } from './client'
export { createClient as createServerClient } from './server'
export { updateSession } from './middleware'
export type { Database } from './types'
```

---

## Package: @ai-life-os/ai

### src/config.ts

```typescript
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'

export const models = {
  'gpt-4o': openai('gpt-4o'),
  'gpt-4o-mini': openai('gpt-4o-mini'),
  'claude-3-5-sonnet': anthropic('claude-3-5-sonnet-20241022'),
  'claude-3-5-haiku': anthropic('claude-3-5-haiku-20241022'),
} as const

export type ModelId = keyof typeof models

export function getModel(id: ModelId) {
  return models[id]
}
```

### src/prompts.ts

```typescript
export const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant.`

export function buildSystemPrompt(base: string, context?: string): string {
  if (!context) return base
  return `${base}\n\nContext:\n${context}`
}
```

### src/index.ts

```typescript
export { models, getModel, type ModelId } from './config'
export { DEFAULT_SYSTEM_PROMPT, buildSystemPrompt } from './prompts'
```

---

## App: Chat Endpoint

### apps/web/app/api/chat/route.ts

```typescript
import { streamText } from 'ai'
import { createServerClient } from '@ai-life-os/supabase'
import { getModel, type ModelId } from '@ai-life-os/ai'

export async function POST(req: Request) {
  const { messages, chatId, assistantId } = await req.json()

  const supabase = await createServerClient()

  // Получить настройки ассистента
  const { data: assistant } = await supabase
    .from('assistants')
    .select('system_prompt, model')
    .eq('id', assistantId)
    .single()

  if (!assistant) {
    return new Response('Assistant not found', { status: 404 })
  }

  const model = getModel(assistant.model as ModelId)

  const result = streamText({
    model,
    system: assistant.system_prompt,
    messages,
    onFinish: async ({ text }) => {
      // Сохранить ответ
      await supabase.from('messages').insert({
        chat_id: chatId,
        role: 'assistant',
        content: text,
      })
    },
  })

  return result.toDataStreamResponse()
}
```

---

## App: Chat Page

### apps/web/app/(chat)/[chatId]/page.tsx

```typescript
'use client'

import { useChat } from 'ai/react'
import { useEffect, useState } from 'react'
import { createClient } from '@ai-life-os/supabase'
import { ChatMessages } from '@/components/chat/chat-messages'
import { ChatInput } from '@/components/chat/chat-input'

interface Props {
  params: Promise<{ chatId: string }>
}

export default function ChatPage({ params }: Props) {
  const [chatId, setChatId] = useState<string>('')
  const [assistantId, setAssistantId] = useState<string>('')
  const supabase = createClient()

  useEffect(() => {
    params.then(p => {
      setChatId(p.chatId)
      // Load chat to get assistantId
      supabase
        .from('chats')
        .select('assistant_id')
        .eq('id', p.chatId)
        .single()
        .then(({ data }) => {
          if (data) setAssistantId(data.assistant_id)
        })
    })
  }, [params])

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    body: { chatId, assistantId },
    initialMessages: [],
  })

  // Load existing messages
  useEffect(() => {
    if (!chatId) return
    
    supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at')
      .then(({ data }) => {
        // Messages loaded from DB would go here
        // useChat doesn't have setMessages, would need custom solution
      })
  }, [chatId])

  return (
    <div className="flex flex-col h-screen">
      <ChatMessages messages={messages} isLoading={isLoading} />
      <ChatInput
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  )
}
```

---

## Database Schema

```sql
-- Ассистенты
create table assistants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  system_prompt text not null,
  model text default 'gpt-4o',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Чаты
create table chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  assistant_id uuid references assistants(id),
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Сообщения
create table messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz default now()
);

-- Индексы
create index idx_chats_user_id on chats(user_id);
create index idx_messages_chat_id on messages(chat_id);

-- RLS
alter table chats enable row level security;
alter table messages enable row level security;

create policy "Users can CRUD own chats"
  on chats for all
  using (auth.uid() = user_id);

create policy "Users can CRUD messages in own chats"
  on messages for all
  using (chat_id in (select id from chats where user_id = auth.uid()));

-- Assistants доступны всем (или добавить owner_id)
alter table assistants enable row level security;

create policy "Assistants are readable by all"
  on assistants for select
  using (true);
```

---

## Quick Start

```bash
# 1. Создать monorepo
pnpm dlx create-turbo@latest ai-life-os --package-manager pnpm
cd ai-life-os

# 2. Очистить example apps (create-turbo создаёт примеры)
rm -rf apps/docs apps/web
mkdir -p apps/web

# 3. Создать Next.js app
cd apps/web
pnpm dlx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false
cd ../..

# 4. Создать packages
mkdir -p packages/supabase/src packages/ai/src packages/ui/src

# 5. Установить зависимости
pnpm add -D turbo typescript --workspace-root
pnpm add ai @ai-sdk/openai @ai-sdk/anthropic --filter @ai-life-os/web
pnpm add @supabase/supabase-js @supabase/ssr --filter @ai-life-os/supabase

# 6. shadcn/ui в web app
cd apps/web
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input card textarea scroll-area avatar
cd ../..

# 7. Создать .env
cat > .env << EOF
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
EOF

# 8. Запустить
pnpm dev
```

---

## Environment Variables

```bash
# .env (root)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_PROJECT_ID=xxx  # для генерации типов

OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Roadmap

| Phase | Что добавляется | Где в структуре |
|-------|-----------------|-----------------|
| **1** | Чат + Админка | apps/web |
| **2** | Память | packages/supabase (pgvector) |
| **3** | Tools | packages/ai |
| **4** | Agents | packages/ai (+ Mastra) |
| **5** | Workflows | packages/ai (Mastra workflows) |
| **6** | Multi-agent | packages/ai |
| **7+** | Новые apps? | apps/mobile, apps/admin |

---

## Команды

```bash
# Разработка
pnpm dev                    # Все apps
pnpm dev --filter web       # Только web

# Build
pnpm build                  # Все
pnpm build --filter web     # Только web

# Type check
pnpm type-check

# Lint
pnpm lint

# Генерация Supabase types
pnpm db:generate
```

---

## Итого

**5 технологий:**
1. **Turborepo** — monorepo management
2. **Next.js** — frontend + backend
3. **Supabase** — database + auth + realtime
4. **Vercel AI SDK** — AI integration
5. **shadcn/ui** — UI компоненты

**Структура готова к:**
- ✅ Phase 1: Чат и админка
- ✅ Phase 4+: Mastra в packages/ai
- ✅ Новым apps (mobile, admin dashboard)
- ✅ Shared code между apps

**Время до Phase 1:** 2 недели