# Phase 1: AI Life OS Stack Setup with Agent-Optimized Infrastructure

## Overview

Setting up Turborepo monorepo with Next.js 15, Mastra (AI framework), assistant-ui (chat UI), Supabase, and shadcn/ui. The hybrid approach uses create-turbo as base, then adds agent-optimized layer: CLAUDE.md files for each package, Vitest with property-based testing, JSON output for agent parsing, and MCP server configuration.

**Updated stack** (per additiona.md findings):
- Mastra replaces raw Vercel AI SDK (Mastra includes AI SDK + agents/workflows/tools)
- assistant-ui for production-ready chat components (integrates with Mastra)
- OpenAI provider initially (Mastra supports 40+ providers for future expansion)

Key optimization: Claude Code Task tool enables parallel agent work on independent packages.

## Planning Context

### Decision Log

| Decision | Reasoning Chain |
|----------|-----------------|
| Hybrid approach over manual | create-turbo provides best-practice configs -> manual setup risks missing Turborepo optimizations -> hybrid gives foundation + customization layer |
| Vitest over Jest | Vitest native ESM support -> faster cold starts for watch mode -> agents can iterate faster -> JSON reporter parses cleanly for agent consumption |
| Property-based testing (fast-check) | Few tests cover many input combinations -> agents generate fewer tests with better coverage -> reduces test maintenance burden |
| Testcontainers for integration | Real Supabase/PostgreSQL -> catches real integration bugs -> agents don't waste time on mock-passing/prod-failing scenarios |
| CLAUDE.md per package | Just-in-time context loading -> agents only load relevant context -> reduces token usage in large monorepo |
| CLAUDE.md size flexibility | User specified "flexible" over strict 200 token limit -> prioritize complete context over brevity -> agents get full picture without artificial truncation |
| Claude Code Task tool for parallelization | Built-in capability -> no external orchestration overhead -> each package is self-contained test target -> natural parallel boundaries |
| Supabase MCP server | Direct database schema access for agents -> no manual schema description -> agents can query types and relations |
| pnpm workspace protocol | workspace:* ensures local packages resolve correctly -> Turborepo depends on it -> industry standard for monorepos |
| Strict TypeScript | Catches errors at compile time -> agents get immediate feedback -> reduces runtime debugging |
| Mastra over raw Vercel AI SDK | Mastra is extension of AI SDK (not alternative) -> 795K downloads/week, YC-funded -> provides Agent class, workflows, human-in-the-loop, tracing out of box -> v1 releasing Jan 2026 = ideal timing -> saves 2-4 weeks building agent infrastructure |
| assistant-ui over custom chat components | 450K+ downloads/month, YC-funded -> official Mastra integration -> built on shadcn/ui + Tailwind (matches our stack) -> streaming, markdown, code highlighting, attachments built-in -> saves 1-2 weeks on chat UI |
| OpenAI provider initially | User specified "only OpenAI for now" -> Mastra supports 40+ providers so architecture ready for expansion -> no need for ANTHROPIC_API_KEY in Phase 1 -> simplifies initial .env config |
| UI wrapper package for shadcn | Version isolation -> one place for component updates across monorepo -> customization layer for consistent styling -> user confirmed (Recommended) |
| Missing SUPABASE env vars: throw error | User specified "fail fast" -> missing credentials should crash at startup -> prevents silent data access failures in production -> clear error message guides developer |
| Empty context in buildSystemPrompt: return base | User specified "return base prompt only" -> empty/undefined context is valid use case (generic assistant) -> no exception needed -> function remains composable |
| test-json.sh --force flag | Agents require fresh test execution results to validate changes -> cached results would report stale outcomes from previous runs -> --force ensures real execution despite Turborepo cache -> critical for agent-optimized infrastructure |

### Rejected Alternatives

| Alternative | Why Rejected |
|-------------|--------------|
| Manual setup from scratch | Higher risk of misconfiguration, no community-tested defaults |
| Jest test runner | Slower startup, ESM support requires configuration gymnastics |
| Mock-based integration tests | Pass in tests, fail in production; agents learn wrong patterns |
| LangGraph/CrewAI orchestration | External dependency overhead when Claude Code Task tool suffices |
| Single monolithic CLAUDE.md | Context bloat in large projects; agents load unnecessary info |
| Raw Vercel AI SDK | Would require building agent/workflow infrastructure from scratch; Mastra provides this |
| Custom chat components | assistant-ui is production-ready, Mastra-integrated, shadcn-compatible |
| VoltAgent | Focus on observability, but Mastra already has tracing; less mature |
| Google ADK | Only Dec 2025, 5K downloads; too new |
| OpenAI Agents SDK | Lightweight but vendor lock-in on OpenAI |
| LangChain.js | More downloads but Python-port; Mastra is native TypeScript |
| CopilotKit | Good but assistant-ui integrates better with Mastra |

### Constraints & Assumptions

- Node.js 20+ required for native fetch and ESM
- pnpm 9.15+ for workspace protocol
- Windows environment (Git Bash paths)
- Supabase project must exist (credentials in .env)
- Docker required for testcontainers
- Mastra v1 release timing (Jan 2026) - using latest stable
- Applied: `<default-conventions domain="testing">` (integration > property > unit)
- Applied: `<default-conventions domain="file-creation">` (extend existing, create on clear boundaries)

### Known Risks

| Risk | Mitigation | Anchor |
|------|------------|--------|
| create-turbo example apps conflict | Clean removal script in M1 | N/A - new project |
| Windows path issues with bash scripts | Use cross-platform npm scripts | N/A - new project |
| Supabase MCP not installed | Document installation steps, graceful degradation | N/A |
| Testcontainers Docker dependency | Clear prerequisite documentation | N/A |
| Mastra v1 breaking changes | Pin to specific version, monitor changelog | N/A - new project |

## Invisible Knowledge

### Architecture

```
ai-life-os/
├── apps/
│   └── web/                    # Next.js 15 App Router
│       └── .claude/            # Web-specific context
├── packages/
│   ├── supabase/              # Database + Auth layer
│   │   └── .claude/           # Supabase-specific context
│   ├── ai/                    # Mastra agents, workflows, tools
│   │   ├── agents/            # Agent definitions
│   │   ├── workflows/         # Workflow definitions
│   │   ├── tools/             # Custom tools
│   │   └── .claude/           # AI-specific context
│   └── ui/                    # assistant-ui + shadcn components
│       └── .claude/           # UI-specific context
├── tooling/
│   ├── eslint/                # Shared lint config
│   └── typescript/            # Shared TS configs
└── .claude/                   # Root context + MCP config
```

### Data Flow

```
assistant-ui (Chat UI)
      ↓
Mastra (Agents + Workflows)
      ↓
Vercel AI SDK (Streaming + Model routing)
      ↓
Supabase (Storage + Memory + Auth)
```

Agent Request → Load CLAUDE.md → Scope to Package → Execute Task → Run Tests → Report Results
                      ↓
               MCP Servers (Filesystem, Git, Supabase)

### Why This Structure

- **packages/** separation: Each package has clear responsibility, enabling parallel agent development
- **packages/ai/ subfolders**: agents/, workflows/, tools/ for Mastra organization
- **.claude/** directories: Just-in-time context loading; agents don't load all context upfront
- **tooling/** isolation: Shared configs don't pollute package dependencies
- **MCP integration**: Agents query schema/files without manual description

### Invariants

1. Each package must have working `pnpm test` command
2. All tests must produce JSON output for agent parsing
3. CLAUDE.md size is flexible (user-specified), prioritize completeness over brevity
4. No circular dependencies between packages
5. Missing SUPABASE env vars must throw at startup (fail fast)

### Tradeoffs

- More initial setup files vs. long-term agent efficiency
- Docker dependency for tests vs. real integration confidence
- Multiple CLAUDE.md files to maintain vs. context efficiency
- Mastra dependency vs. building agent infrastructure from scratch

## Milestones

### Milestone 1: Foundation - Turborepo Scaffold

**Files**:
- `turbo.json`
- `pnpm-workspace.yaml`
- `package.json`
- `.gitignore`
- `.env.example`

**Requirements**:
- Initialize Turborepo with pnpm workspace
- Configure task pipeline (build, dev, test, lint, type-check)
- Create workspace definition for apps/*, packages/*, tooling/*
- Root package.json with workspace scripts

**Acceptance Criteria**:
- `pnpm install` succeeds
- `pnpm turbo --version` returns version
- Workspace packages recognized by pnpm

**Tests**: Skip - infrastructure setup milestone

**Code Intent**:
- Create `turbo.json` with tasks: build (dependsOn ^build), dev (persistent), test (outputs coverage), lint, type-check
- Create `pnpm-workspace.yaml` listing apps/*, packages/*, tooling/*
- Create root `package.json` with scripts: dev, build, test, lint, type-check (all via turbo)
- Create `.env.example` with placeholder vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, OPENAI_API_KEY (Decision: "OpenAI provider initially" - no ANTHROPIC_API_KEY needed in Phase 1)

### Code Changes

```diff
--- /dev/null
+++ b/turbo.json
@@ -0,0 +1,31 @@
+{
+  "$schema": "https://turbo.build/schema.json",
+  "tasks": {
+    "build": {
+      "dependsOn": ["^build"],
+      "outputs": [".next/**", "dist/**"]
+    },
+    "dev": {
+      "cache": false,
+      "persistent": true
+    },
+    "test": {
+      "outputs": ["coverage/**", "test-results.json"]
+    },
+    "lint": {
+      "dependsOn": ["^lint"]
+    },
+    "type-check": {
+      "dependsOn": ["^type-check"]
+    }
+  }
+}
+```

```diff
--- /dev/null
+++ b/pnpm-workspace.yaml
@@ -0,0 +1,5 @@
+packages:
+  - "apps/*"
+  - "packages/*"
+  - "tooling/*"
+```

```diff
--- /dev/null
+++ b/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "ai-life-os",
+  "private": true,
+  "scripts": {
+    "dev": "turbo dev",
+    "build": "turbo build",
+    "test": "turbo test",
+    "lint": "turbo lint",
+    "type-check": "turbo type-check"
+  },
+  "devDependencies": {
+    "turbo": "^2.3.3"
+  },
+  "engines": {
+    "node": ">=20.0.0",
+    "pnpm": ">=9.15.0"
+  },
+  "packageManager": "pnpm@9.15.0"
+}
+```

```diff
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,37 @@
+# Dependencies
+node_modules/
+.pnp
+.pnp.js
+
+# Testing
+coverage/
+test-results.json
+
+# Next.js
+.next/
+out/
+
+# Production
+build/
+dist/
+
+# Misc
+.DS_Store
+*.pem
+
+# Debug
+npm-debug.log*
+yarn-debug.log*
+yarn-error.log*
+pnpm-debug.log*
+
+# Local env files
+.env
+.env*.local
+
+# Vercel
+.vercel
+
+# Turborepo
+.turbo
+```

```diff
--- /dev/null
+++ b/.env.example
@@ -0,0 +1,5 @@
+# Supabase
+NEXT_PUBLIC_SUPABASE_URL=your-project-url
+NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
+
+OPENAI_API_KEY=your-openai-api-key
+```

---

### Milestone 2: Tooling Packages - Shared Configs

**Files**:
- `tooling/typescript/base.json`
- `tooling/typescript/nextjs.json`
- `tooling/typescript/library.json`
- `tooling/typescript/package.json`
- `tooling/eslint/base.js`
- `tooling/eslint/package.json`

**Requirements**:
- Shared TypeScript configs with strict mode
- Base config for libraries, extended config for Next.js
- Shared ESLint config with TypeScript support

**Acceptance Criteria**:
- TypeScript configs extend correctly
- ESLint config exports work

**Tests**: Skip - configuration files

**Code Intent**:
- Create `tooling/typescript/base.json`: strict mode, ES2022 target, moduleResolution bundler
- Create `tooling/typescript/library.json`: extends base, declaration: true
- Create `tooling/typescript/nextjs.json`: extends base, jsx preserve, next plugin
- Create `tooling/eslint/base.js`: extends @typescript-eslint, prettier compat

### Code Changes

```diff
--- /dev/null
+++ b/tooling/typescript/base.json
@@ -0,0 +1,20 @@
+{
+  "$schema": "https://json.schemastore.org/tsconfig",
+  "compilerOptions": {
+    "strict": true,
+    "target": "ES2022",
+    "lib": ["ES2022"],
+    "module": "ESNext",
+    "moduleResolution": "bundler",
+    "skipLibCheck": true,
+    "esModuleInterop": true,
+    "resolveJsonModule": true,
+    "isolatedModules": true,
+    "incremental": true,
+    "noUncheckedIndexedAccess": true,
+    "forceConsistentCasingInFileNames": true
+  },
+  "exclude": ["node_modules"]
+}
+```

```diff
--- /dev/null
+++ b/tooling/typescript/library.json
@@ -0,0 +1,9 @@
+{
+  "$schema": "https://json.schemastore.org/tsconfig",
+  "extends": "./base.json",
+  "compilerOptions": {
+    "declaration": true,
+    "declarationMap": true,
+    "outDir": "dist"
+  }
+}
+```

```diff
--- /dev/null
+++ b/tooling/typescript/nextjs.json
@@ -0,0 +1,11 @@
+{
+  "$schema": "https://json.schemastore.org/tsconfig",
+  "extends": "./base.json",
+  "compilerOptions": {
+    "jsx": "preserve",
+    "lib": ["ES2022", "DOM", "DOM.Iterable"],
+    "plugins": [{ "name": "next" }],
+    "noEmit": true
+  },
+  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]
+}
+```

```diff
--- /dev/null
+++ b/tooling/typescript/package.json
@@ -0,0 +1,7 @@
+{
+  "name": "@ai-life-os/typescript-config",
+  "version": "0.0.0",
+  "private": true,
+  "devDependencies": {
+    "typescript": "^5.7.2"
+  }
+}
+```

```diff
--- /dev/null
+++ b/tooling/eslint/base.js
@@ -0,0 +1,20 @@
+module.exports = {
+  parser: "@typescript-eslint/parser",
+  extends: [
+    "eslint:recommended",
+    "plugin:@typescript-eslint/recommended",
+    "prettier"
+  ],
+  plugins: ["@typescript-eslint"],
+  env: {
+    node: true,
+    es2022: true
+  },
+  parserOptions: {
+    ecmaVersion: 2022,
+    sourceType: "module"
+  },
+  rules: {
+    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
+  }
+};
+```

```diff
--- /dev/null
+++ b/tooling/eslint/package.json
@@ -0,0 +1,11 @@
+{
+  "name": "@ai-life-os/eslint-config",
+  "version": "0.0.0",
+  "private": true,
+  "devDependencies": {
+    "@typescript-eslint/eslint-plugin": "^8.21.0",
+    "@typescript-eslint/parser": "^8.21.0",
+    "eslint": "^9.18.0",
+    "eslint-config-prettier": "^9.1.0"
+  }
+}
+```

---

### Milestone 3: Package - @ai-life-os/supabase

**Files**:
- `packages/supabase/package.json`
- `packages/supabase/tsconfig.json`
- `packages/supabase/src/index.ts`
- `packages/supabase/src/client.ts`
- `packages/supabase/src/server.ts`
- `packages/supabase/src/middleware.ts`
- `packages/supabase/src/types.ts`
- `packages/supabase/vitest.config.ts`
- `packages/supabase/tests/client.test.ts`

**Flags**: `conformance`, `error-handling`

**Requirements**:
- Browser client creation (createBrowserClient)
- Server client creation (createServerClient with cookies)
- Auth middleware for route protection
- Type-safe Database type export
- Property-based tests for client creation
- Throw error on missing env vars (Decision: "fail fast")

**Acceptance Criteria**:
- `pnpm --filter @ai-life-os/supabase test` passes
- Exports: createClient, createServerClient, updateSession, Database type
- TypeScript compiles without errors
- Missing SUPABASE_URL throws Error with descriptive message

**Tests**:
- **Test files**: `packages/supabase/tests/client.test.ts`
- **Test type**: property-based (fast-check)
- **Backing**: user-specified
- **Scenarios**:
  - Normal: client creation with valid env vars
  - Edge: missing env var throws Error with message "NEXT_PUBLIC_SUPABASE_URL is required"
  - Error: malformed URL rejection

**Code Intent**:
- Create `packages/supabase/package.json`: name @ai-life-os/supabase, deps @supabase/supabase-js, @supabase/ssr
- Create `src/client.ts`: createBrowserClient<Database> with env vars; throw Error if missing (Decision: "Missing SUPABASE env vars: throw error")
- Create `src/server.ts`: createServerClient with cookie handlers for Next.js App Router
- Create `src/middleware.ts`: updateSession function for auth middleware
- Create `src/types.ts`: placeholder Database type (generated later via supabase gen types)
- Create `vitest.config.ts`: with JSON reporter, fast-check integration
- Create `tests/client.test.ts`: property tests for env var handling including error case

### Code Changes

```diff
--- /dev/null
+++ b/packages/supabase/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "@ai-life-os/supabase",
+  "version": "0.0.0",
+  "private": true,
+  "main": "./src/index.ts",
+  "types": "./src/index.ts",
+  "scripts": {
+    "test": "vitest run --reporter=json --outputFile=test-results.json",
+    "test:watch": "vitest",
+    "type-check": "tsc --noEmit"
+  },
+  "dependencies": {
+    "@supabase/supabase-js": "^2.48.1",
+    "@supabase/ssr": "^0.7.1"
+  },
+  "devDependencies": {
+    "@ai-life-os/typescript-config": "workspace:*",
+    "vitest": "^3.0.5",
+    "fast-check": "^3.24.2",
+    "typescript": "^5.7.2"
+  }
+}
+```

```diff
--- /dev/null
+++ b/packages/supabase/tsconfig.json
@@ -0,0 +1,7 @@
+{
+  "extends": "@ai-life-os/typescript-config/library.json",
+  "compilerOptions": {
+    "outDir": "dist"
+  },
+  "include": ["src/**/*"]
+}
+```

```diff
--- /dev/null
+++ b/packages/supabase/src/index.ts
@@ -0,0 +1,3 @@
+export { createClient } from './client';
+export { createServerClient } from './server';
+export { updateSession } from './middleware';
+export type { Database } from './types';
+```

```diff
--- /dev/null
+++ b/packages/supabase/src/client.ts
@@ -0,0 +1,19 @@
+import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
+import type { Database } from './types';
+
+export function createClient() {
+  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
+  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
+
+  if (!supabaseUrl) {
+    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
+  }
+
+  if (!supabaseAnonKey) {
+    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
+  }
+
+  return createSupabaseBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
+}
+```

```diff
--- /dev/null
+++ b/packages/supabase/src/server.ts
@@ -0,0 +1,33 @@
+import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
+import { cookies } from 'next/headers';
+import type { Database } from './types';
+
+export async function createServerClient() {
+  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
+  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
+
+  if (!supabaseUrl) {
+    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
+  }
+
+  if (!supabaseAnonKey) {
+    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
+  }
+
+  const cookieStore = await cookies();
+
+  return createSupabaseServerClient<Database>(supabaseUrl, supabaseAnonKey, {
+    cookies: {
+      getAll() {
+        return cookieStore.getAll();
+      },
+      setAll(cookiesToSet) {
+        cookiesToSet.forEach(({ name, value, options }) => {
+          cookieStore.set(name, value, options);
+        });
+      },
+    },
+  });
+}
+```

```diff
--- /dev/null
+++ b/packages/supabase/src/middleware.ts
@@ -0,0 +1,32 @@
+import { createServerClient } from '@supabase/ssr';
+import { type NextRequest, NextResponse } from 'next/server';
+import type { Database } from './types';
+
+export async function updateSession(request: NextRequest) {
+  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
+  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
+
+  if (!supabaseUrl) {
+    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
+  }
+
+  if (!supabaseAnonKey) {
+    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
+  }
+
+  let response = NextResponse.next({ request });
+
+  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
+    cookies: {
+      getAll() {
+        return request.cookies.getAll();
+      },
+      setAll(cookiesToSet) {
+        cookiesToSet.forEach(({ name, value, options }) => {
+          response.cookies.set(name, value, options);
+        });
+      },
+    },
+  });
+
+  await supabase.auth.getUser();
+
+  return response;
+}
+```

```diff
--- /dev/null
+++ b/packages/supabase/src/types.ts
@@ -0,0 +1,2 @@
+export type Database = Record<string, never>;
+```

```diff
--- /dev/null
+++ b/packages/supabase/vitest.config.ts
@@ -0,0 +1,11 @@
+import { defineConfig } from 'vitest/config';
+
+export default defineConfig({
+  test: {
+    globals: true,
+    environment: 'node',
+    reporters: ['json'],
+    outputFile: 'test-results.json',
+    coverage: { provider: 'v8' },
+  },
+});
+```

```diff
--- /dev/null
+++ b/packages/supabase/tests/client.test.ts
@@ -0,0 +1,36 @@
+import { describe, it, expect, beforeEach, afterEach } from 'vitest';
+import * as fc from 'fast-check';
+import { createClient } from '../src/client';
+
+describe('createClient', () => {
+  const originalEnv = process.env;
+
+  beforeEach(() => {
+    process.env = { ...originalEnv };
+  });
+
+  afterEach(() => {
+    process.env = originalEnv;
+  });
+
+  it('throws Error when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
+    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
+    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
+
+    expect(() => createClient()).toThrow('NEXT_PUBLIC_SUPABASE_URL is required');
+  });
+
+  it('throws Error when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
+    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
+    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
+
+    expect(() => createClient()).toThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
+  });
+
+  it('property: valid URLs create client without error', () => {
+    fc.assert(fc.property(fc.webUrl(), fc.string({ minLength: 10 }), (url, key) => {
+      process.env.NEXT_PUBLIC_SUPABASE_URL = url;
+      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = key;
+      expect(() => createClient()).not.toThrow();
+    }));
+  });
+});
+```

---

### Milestone 4: Package - @ai-life-os/ai (Mastra)

**Files**:
- `packages/ai/package.json`
- `packages/ai/tsconfig.json`
- `packages/ai/src/index.ts`
- `packages/ai/src/config.ts`
- `packages/ai/src/prompts.ts`
- `packages/ai/src/agents/.gitkeep`
- `packages/ai/src/workflows/.gitkeep`
- `packages/ai/src/tools/.gitkeep`
- `packages/ai/vitest.config.ts`
- `packages/ai/tests/config.test.ts`

**Flags**: `needs-rationale`

**Requirements**:
- Mastra core setup with OpenAI provider
- Model configuration for gpt-4o, gpt-4o-mini
- Type-safe ModelId type
- getModel function with type inference
- System prompt builder with context injection (returns base if empty)
- Directory structure for agents/workflows/tools (Mastra convention)
- Property-based tests

**Acceptance Criteria**:
- `pnpm --filter @ai-life-os/ai test` passes
- Exports: models, getModel, ModelId, buildSystemPrompt, mastra instance
- Type inference works for model selection
- buildSystemPrompt("base", undefined) returns "base"

**Tests**:
- **Test files**: `packages/ai/tests/config.test.ts`
- **Test type**: property-based
- **Backing**: user-specified
- **Scenarios**:
  - Normal: getModel returns correct provider for each ModelId
  - Edge: buildSystemPrompt with empty/undefined context returns base prompt only (Decision: "Empty context in buildSystemPrompt")
  - Error: N/A (type system prevents invalid ModelId)

**Code Intent**:
- Create `packages/ai/package.json`: deps @mastra/core, @mastra/ai-sdk, @ai-sdk/openai (Decision: "Mastra over raw Vercel AI SDK", "OpenAI provider initially")
- Create `src/config.ts`: models object mapping ModelId (gpt-4o, gpt-4o-mini) to OpenAI provider calls; getModel function
- Create `src/prompts.ts`: DEFAULT_SYSTEM_PROMPT, buildSystemPrompt(base, context?) that returns base if context is empty/undefined
- Create directory stubs: agents/, workflows/, tools/ with .gitkeep (Mastra organization pattern)
- Create `vitest.config.ts`: with JSON reporter
- Create `tests/config.test.ts`: fast-check tests for model resolution and empty context handling

### Code Changes

```diff
--- /dev/null
+++ b/packages/ai/package.json
@@ -0,0 +1,24 @@
+{
+  "name": "@ai-life-os/ai",
+  "version": "0.0.0",
+  "private": true,
+  "main": "./src/index.ts",
+  "types": "./src/index.ts",
+  "scripts": {
+    "test": "vitest run --reporter=json --outputFile=test-results.json",
+    "test:watch": "vitest",
+    "type-check": "tsc --noEmit"
+  },
+  "dependencies": {
+    "@mastra/core": "^0.1.62",
+    "@ai-sdk/openai": "^1.0.10"
+  },
+  "devDependencies": {
+    "@ai-life-os/typescript-config": "workspace:*",
+    "vitest": "^3.0.5",
+    "fast-check": "^3.24.2",
+    "typescript": "^5.7.2"
+  }
+}
+```

```diff
--- /dev/null
+++ b/packages/ai/tsconfig.json
@@ -0,0 +1,7 @@
+{
+  "extends": "@ai-life-os/typescript-config/library.json",
+  "compilerOptions": {
+    "outDir": "dist"
+  },
+  "include": ["src/**/*"]
+}
+```

```diff
--- /dev/null
+++ b/packages/ai/src/index.ts
@@ -0,0 +1,4 @@
+export { models, getModel } from './config';
+export type { ModelId } from './config';
+export { DEFAULT_SYSTEM_PROMPT, buildSystemPrompt } from './prompts';
+export { mastra } from './config';
+```

```diff
--- /dev/null
+++ b/packages/ai/src/config.ts
@@ -0,0 +1,23 @@
+import { Mastra } from '@mastra/core';
+import { openai } from '@ai-sdk/openai';
+
+export const models = {
+  'gpt-4o': openai('gpt-4o'),
+  'gpt-4o-mini': openai('gpt-4o-mini'),
+} as const;
+
+export type ModelId = keyof typeof models;
+
+export function getModel(modelId: ModelId) {
+  return models[modelId];
+}
+
+export const mastra = new Mastra({
+  agents: {},
+  workflows: {},
+  tools: {},
+  logs: {
+    provider: 'CONSOLE',
+    level: 'INFO',
+  },
+});
+```

```diff
--- /dev/null
+++ b/packages/ai/src/prompts.ts
@@ -0,0 +1,11 @@
+export const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant.`;
+
+export function buildSystemPrompt(
+  base: string,
+  context?: string | null
+): string {
+  if (!context || context.trim() === '') {
+    return base;
+  }
+  return `${base}\n\nAdditional context:\n${context}`;
+}
+```

```diff
--- /dev/null
+++ b/packages/ai/src/agents/.gitkeep
@@ -0,0 +1 @@
+```

```diff
--- /dev/null
+++ b/packages/ai/src/workflows/.gitkeep
@@ -0,0 +1 @@
+```

```diff
--- /dev/null
+++ b/packages/ai/src/tools/.gitkeep
@@ -0,0 +1 @@
+```

```diff
--- /dev/null
+++ b/packages/ai/vitest.config.ts
@@ -0,0 +1,11 @@
+import { defineConfig } from 'vitest/config';
+
+export default defineConfig({
+  test: {
+    globals: true,
+    environment: 'node',
+    reporters: ['json'],
+    outputFile: 'test-results.json',
+    coverage: { provider: 'v8' },
+  },
+});
+```

```diff
--- /dev/null
+++ b/packages/ai/tests/config.test.ts
@@ -0,0 +1,33 @@
+import { describe, it, expect } from 'vitest';
+import * as fc from 'fast-check';
+import { getModel, models } from '../src/config';
+import { buildSystemPrompt } from '../src/prompts';
+
+describe('AI Configuration', () => {
+  describe('getModel', () => {
+    it('property: returns correct model for all ModelIds', () => {
+      const modelIds = Object.keys(models) as Array<keyof typeof models>;
+      fc.assert(
+        fc.property(fc.constantFrom(...modelIds), (modelId) => {
+          const model = getModel(modelId);
+          expect(model).toBeDefined();
+          expect(model).toBe(models[modelId]);
+        })
+      );
+    });
+  });
+
+  describe('buildSystemPrompt', () => {
+    it('returns base prompt when context is undefined', () => {
+      const base = 'Base prompt';
+      expect(buildSystemPrompt(base, undefined)).toBe(base);
+    });
+
+    it('returns base prompt when context is empty string', () => {
+      const base = 'Base prompt';
+      expect(buildSystemPrompt(base, '')).toBe(base);
+      expect(buildSystemPrompt(base, '   ')).toBe(base);
+    });
+  });
+});
+```

---

### Milestone 5: Package - @ai-life-os/ui (assistant-ui + shadcn)

**Files**:
- `packages/ui/package.json`
- `packages/ui/tsconfig.json`
- `packages/ui/src/index.ts`
- `packages/ui/src/button.tsx`
- `packages/ui/src/input.tsx`
- `packages/ui/src/card.tsx`
- `packages/ui/src/chat/index.ts`

**Requirements**:
- Wrapper exports for shadcn/ui components (version isolation)
- assistant-ui chat components re-export
- Re-export pattern for consistent imports across apps
- TypeScript React component definitions

**Acceptance Criteria**:
- Package compiles without errors
- Components exported from index.ts
- Chat components exported from chat/index.ts

**Tests**: Skip - UI wrapper components have no business logic; behavior tested via M6 app integration tests (convention: test behavior at boundaries, not pass-through wrappers)

**Code Intent**:
- Create `packages/ui/package.json`: deps react, @assistant-ui/react; peerDeps tailwindcss (Decision: "assistant-ui over custom chat components", "UI wrapper package for shadcn")
- Create shadcn component files: thin wrappers that re-export shadcn components (actual shadcn install in apps/web)
- Create `src/chat/index.ts`: re-export assistant-ui components (Thread, Message, Composer, etc.)
- Create `src/index.ts`: re-export all components

### Code Changes

```diff
--- /dev/null
+++ b/packages/ui/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "@ai-life-os/ui",
+  "version": "0.0.0",
+  "private": true,
+  "main": "./src/index.ts",
+  "types": "./src/index.ts",
+  "scripts": {
+    "type-check": "tsc --noEmit"
+  },
+  "dependencies": {
+    "@assistant-ui/react": "^0.5.100",
+    "react": "^19.0.0"
+  },
+  "peerDependencies": {
+    "tailwindcss": "^3.4.0"
+  },
+  "devDependencies": {
+    "@ai-life-os/typescript-config": "workspace:*",
+    "@types/react": "^19.0.9",
+    "typescript": "^5.7.2"
+  }
+}
+```

```diff
--- /dev/null
+++ b/packages/ui/tsconfig.json
@@ -0,0 +1,10 @@
+{
+  "extends": "@ai-life-os/typescript-config/library.json",
+  "compilerOptions": {
+    "jsx": "react-jsx",
+    "lib": ["ES2022", "DOM", "DOM.Iterable"],
+    "outDir": "dist"
+  },
+  "include": ["src/**/*"]
+}
+```

```diff
--- /dev/null
+++ b/packages/ui/src/index.ts
@@ -0,0 +1,4 @@
+export * from './button';
+export * from './input';
+export * from './card';
+export * from './chat';
+```

```diff
--- /dev/null
+++ b/packages/ui/src/button.tsx
@@ -0,0 +1,5 @@
+import * as React from 'react';
+
+export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>((props, ref) => <button ref={ref} {...props} />);
+Button.displayName = 'Button';
+```

```diff
--- /dev/null
+++ b/packages/ui/src/input.tsx
@@ -0,0 +1,5 @@
+import * as React from 'react';
+
+export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => <input ref={ref} {...props} />);
+Input.displayName = 'Input';
+```

```diff
--- /dev/null
+++ b/packages/ui/src/card.tsx
@@ -0,0 +1,7 @@
+import * as React from 'react';
+
+export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => <div ref={ref} {...props} />);
+export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => <div ref={ref} {...props} />);
+export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => <div ref={ref} {...props} />);
+Card.displayName = 'Card';
+```

```diff
--- /dev/null
+++ b/packages/ui/src/chat/index.ts
@@ -0,0 +1,8 @@
+export {
+  Thread,
+  ThreadWelcome,
+  Composer,
+  ComposerInput,
+  ComposerSend,
+  AssistantMessage,
+} from '@assistant-ui/react';
+```

---

### Milestone 6: App - @ai-life-os/web Foundation

**Files**:
- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/next.config.ts`
- `apps/web/tailwind.config.ts`
- `apps/web/postcss.config.js`
- `apps/web/app/layout.tsx`
- `apps/web/app/page.tsx`
- `apps/web/vitest.config.ts`

**Flags**: `conformance`

**Requirements**:
- Next.js 15 App Router setup
- Tailwind CSS configuration
- Workspace package imports (@ai-life-os/supabase, @ai-life-os/ai, @ai-life-os/ui)
- Base layout with metadata

**Acceptance Criteria**:
- `pnpm --filter @ai-life-os/web dev` starts dev server
- `pnpm --filter @ai-life-os/web build` succeeds
- Workspace packages import correctly

**Tests**:
- **Test files**: `apps/web/tests/setup.test.ts`
- **Test type**: integration
- **Backing**: user-specified (integration tests with real dependencies confirmed)
- **Scenarios**:
  - Normal: Next.js builds successfully
  - Edge: workspace packages resolve correctly

**Code Intent**:
- Create `apps/web/package.json`: deps next, react, workspace:* for internal packages
- Create `next.config.ts`: transpilePackages for workspace packages
- Create `tailwind.config.ts`: content paths including packages/ui
- Create `app/layout.tsx`: RootLayout with html, body, basic metadata
- Create `app/page.tsx`: placeholder home page
- Create `vitest.config.ts`: with JSON reporter for agent consumption

### Code Changes

```diff
--- /dev/null
+++ b/apps/web/package.json
@@ -0,0 +1,29 @@
+{
+  "name": "@ai-life-os/web",
+  "version": "0.0.0",
+  "private": true,
+  "scripts": {
+    "dev": "next dev",
+    "build": "next build",
+    "start": "next start",
+    "lint": "next lint",
+    "test": "vitest run --reporter=json --outputFile=test-results.json",
+    "test:watch": "vitest",
+    "type-check": "tsc --noEmit"
+  },
+  "dependencies": {
+    "next": "^15.1.6",
+    "react": "^19.0.0",
+    "react-dom": "^19.0.0",
+    "@ai-life-os/supabase": "workspace:*",
+    "@ai-life-os/ai": "workspace:*",
+    "@ai-life-os/ui": "workspace:*"
+  },
+  "devDependencies": {
+    "@ai-life-os/typescript-config": "workspace:*",
+    "@ai-life-os/eslint-config": "workspace:*",
+    "@types/react": "^19.0.9",
+    "vitest": "^3.0.5",
+    "typescript": "^5.7.2",
+    "tailwindcss": "^3.4.20",
+    "postcss": "^8.4.49",
+    "autoprefixer": "^10.4.20"
+  }
+}
+```

```diff
--- /dev/null
+++ b/apps/web/tsconfig.json
@@ -0,0 +1,4 @@
+{
+  "extends": "@ai-life-os/typescript-config/nextjs.json",
+  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]
+}
+```

```diff
--- /dev/null
+++ b/apps/web/next.config.ts
@@ -0,0 +1,8 @@
+import type { NextConfig } from 'next';
+
+const config: NextConfig = {
+  transpilePackages: ['@ai-life-os/supabase', '@ai-life-os/ai', '@ai-life-os/ui'],
+};
+
+export default config;
+```

```diff
--- /dev/null
+++ b/apps/web/tailwind.config.ts
@@ -0,0 +1,13 @@
+import type { Config } from 'tailwindcss';
+
+const config: Config = {
+  content: [
+    './app/**/*.{ts,tsx}',
+    './components/**/*.{ts,tsx}',
+    '../../packages/ui/src/**/*.{ts,tsx}',
+  ],
+  theme: {},
+  plugins: [],
+};
+
+export default config;
+```

```diff
--- /dev/null
+++ b/apps/web/postcss.config.js
@@ -0,0 +1,6 @@
+module.exports = {
+  plugins: {
+    tailwindcss: {},
+    autoprefixer: {},
+  },
+};
+```

```diff
--- /dev/null
+++ b/apps/web/app/layout.tsx
@@ -0,0 +1,20 @@
+import type { Metadata } from 'next';
+import './globals.css';
+
+export const metadata: Metadata = {
+  title: 'AI Life OS',
+  description: 'Personal AI assistant for life management',
+};
+
+export default function RootLayout({
+  children,
+}: {
+  children: React.ReactNode;
+}) {
+  return (
+    <html lang="en">
+      <body>{children}</body>
+    </html>
+  );
+}
+```

```diff
--- /dev/null
+++ b/apps/web/app/page.tsx
@@ -0,0 +1,9 @@
+export default function Home() {
+  return (
+    <main>
+      <h1>AI Life OS</h1>
+      <p>Welcome to your personal AI assistant.</p>
+    </main>
+  );
+}
+```

```diff
--- /dev/null
+++ b/apps/web/app/globals.css
@@ -0,0 +1,3 @@
+@tailwind base;
+@tailwind components;
+@tailwind utilities;
+```

```diff
--- /dev/null
+++ b/apps/web/vitest.config.ts
@@ -0,0 +1,11 @@
+import { defineConfig } from 'vitest/config';
+
+export default defineConfig({
+  test: {
+    globals: true,
+    environment: 'node',
+    reporters: ['json'],
+    outputFile: 'test-results.json',
+    coverage: { provider: 'v8' },
+  },
+});
+```

```diff
--- /dev/null
+++ b/apps/web/tests/setup.test.ts
@@ -0,0 +1,7 @@
+import { describe, it, expect } from 'vitest';
+
+describe('Next.js setup', () => {
+  it('workspace packages are accessible', async () => {
+    await expect(import('@ai-life-os/ui')).resolves.toBeDefined();
+  });
+});
+```

---

### Milestone 7: Agent Infrastructure - CLAUDE.md Files

**Files**:
- `.claude/CLAUDE.md`
- `packages/supabase/.claude/CLAUDE.md`
- `packages/ai/.claude/CLAUDE.md`
- `packages/ui/.claude/CLAUDE.md`
- `apps/web/.claude/CLAUDE.md`

**Delegated to**: @agent-technical-writer

**Requirements**:
- Root CLAUDE.md with project overview and navigation
- Package-specific CLAUDE.md with focused context
- Size is flexible; prioritize useful context over strict token limits (user-specified)
- Tabular index format with WHAT/WHEN columns

**Acceptance Criteria**:
- Each CLAUDE.md exists with useful context
- Format matches documentation conventions

**Tests**: Skip - documentation milestone

**Code Intent**: Documentation milestone - no code changes.

---

### Milestone 8: Agent Infrastructure - Test Scripts & MCP Config

**Files**:
- `scripts/test-json.sh`
- `.claude/mcp.json`
- `package.json` (update scripts)

**Requirements**:
- Test script that outputs JSON for agent parsing
- MCP server configuration for Filesystem, Git, Supabase
- Root package.json updated with agent-friendly scripts

**Acceptance Criteria**:
- `pnpm test:json` produces parseable JSON output
- MCP config file valid JSON
- Scripts documented in root CLAUDE.md

**Tests**: Skip - infrastructure scripts

**Code Intent**:
- Create `scripts/test-json.sh`: wrapper that runs vitest with JSON reporter, outputs to test-results.json
- Create `.claude/mcp.json`: configure servers (filesystem with project root, git, supabase if available)
- Update root `package.json`: add test:json script

### Code Changes

```diff
--- /dev/null
+++ b/scripts/test-json.sh
@@ -0,0 +1,10 @@
+#!/bin/bash
+set -e
+
+echo "Running tests with JSON reporter..."
+pnpm turbo test --force
+
+echo "Test results available in:"
+find . -name "test-results.json" -type f | grep -v node_modules
+
+echo "Done."
+```

```diff
--- /dev/null
+++ b/.claude/mcp.json
@@ -0,0 +1,20 @@
+{
+  "mcpServers": {
+    "filesystem": {
+      "command": "npx",
+      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/c/projects/ai_life_os_2"]
+    },
+    "git": {
+      "command": "npx",
+      "args": ["-y", "@modelcontextprotocol/server-git", "--repository", "/c/projects/ai_life_os_2"]
+    },
+    "supabase": {
+      "command": "npx",
+      "args": ["-y", "@supabase/mcp-server-supabase"],
+      "env": {
+        "SUPABASE_URL": "${NEXT_PUBLIC_SUPABASE_URL}",
+        "SUPABASE_SERVICE_ROLE_KEY": "${SUPABASE_SERVICE_ROLE_KEY}"
+      }
+    }
+  }
+}
+```

```diff
--- a/package.json
+++ b/package.json
@@ -6,7 +6,8 @@
     "build": "turbo build",
     "test": "turbo test",
     "lint": "turbo lint",
-    "type-check": "turbo type-check"
+    "type-check": "turbo type-check",
+    "test:json": "bash scripts/test-json.sh"
   },
   "devDependencies": {
     "turbo": "^2.3.3"
```

---

### Milestone 9: Documentation

**Delegated to**: @agent-technical-writer (mode: post-implementation)

**Source**: `## Invisible Knowledge` section of this plan

**Files**:
- `.claude/README.md`
- `packages/supabase/README.md`
- `packages/ai/README.md`

**Requirements**:
- README.md for root with architecture diagram
- README.md for packages with invisible knowledge
- Self-contained documentation (no external refs)

**Acceptance Criteria**:
- README.md files exist where invisible knowledge applies
- Architecture diagrams match plan
- No references to external docs

**Tests**: Skip - documentation milestone

**Code Intent**: Documentation milestone - no code changes.

## Milestone Dependencies

```
M1 (Foundation) --> M2 (Tooling)
                        |
        +---------------+---------------+
        |               |               |
        v               v               v
      M3 (supabase)   M4 (ai)        M5 (ui)
        |               |               |
        +---------------+---------------+
                        |
                        v
                    M6 (web)
                        |
                        v
                    M7 (CLAUDE.md)
                        |
                        v
                    M8 (Scripts/MCP)
                        |
                        v
                    M9 (Docs)
```

**Parallel waves**:
- Wave 1: M1
- Wave 2: M2
- Wave 3: M3, M4, M5 (parallel - no dependencies between packages)
- Wave 4: M6
- Wave 5: M7
- Wave 6: M8
- Wave 7: M9
