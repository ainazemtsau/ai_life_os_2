# AI Life OS

## Overview

AI Life OS is a TypeScript monorepo for building AI-powered chat assistants with persistent memory, custom tools, and multi-step workflows. It separates concerns across packages (database, AI logic, UI) to enable parallel development by both human developers and AI agents.

## Architecture

```
ai-life-os/
├── apps/
│   └── web/                    # Next.js 15 App Router
│       └── .claude/            # Web-specific context
├── packages/
│   ├── contracts/             # Shared Zod schemas (leaf node)
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
│   ├── eslint/                # Shared lint config + boundary enforcement
│   └── typescript/            # Shared TS configs
├── scripts/                   # Development automation + integration tests
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

### Agent Workflow

```
Agent Request → Load CLAUDE.md → Scope to Package → Execute Task → Run Tests → Report Results
                      ↓
               MCP Servers (Filesystem, Git, Supabase)
```

## Design Decisions

### Why packages/ separation

Each package has a single, clear responsibility:
- `contracts/`: Shared Zod schemas and types (leaf node, zero dependencies)
- `supabase/`: All database and authentication concerns
- `ai/`: All agent, workflow, and tool definitions
- `ui/`: All chat interface components

This separation enables parallel development where agents can work on one package without requiring context from others. Package boundaries reduce cognitive load and prevent cross-cutting changes.

### Why contracts package as leaf node

contracts has zero internal dependencies, making it a leaf in the dependency graph. All other packages can safely import from contracts without risk of circular dependencies. Centralizing Zod schemas prevents type drift and ensures validation logic stays consistent across packages.

### Why packages/ai/ subfolders

Mastra requires organization into `agents/`, `workflows/`, and `tools/` directories. This structure makes it explicit where each type of AI component lives, enabling agents to scope their work (e.g., "add a tool" → only read `tools/` directory).

### Why .claude/ directories

Just-in-time context loading. Instead of loading all repository context upfront, agents load CLAUDE.md files only for the packages they're modifying. Each package's CLAUDE.md provides scope-specific guidance, reducing token usage and improving agent focus.

### Why tooling/ isolation

Shared configs (ESLint, TypeScript) are isolated from package dependencies. This prevents circular dependencies and ensures lint/type rules are applied uniformly without coupling to package internals.

### Why MCP integration

MCP servers (Filesystem, Git, Supabase) allow agents to query schema, files, and database state without manual description. Agents ask "what tables exist?" instead of relying on stale documentation. This reduces maintenance burden and keeps context accurate.

### Why ESLint boundary enforcement

ESLint no-restricted-imports rules block internal imports (e.g., `@ai-life-os/ui/src/Button`) while allowing barrel exports (e.g., `@ai-life-os/ui`). This enforces public API usage at edit time via editor integration, providing immediate feedback rather than discovering violations at build time. Dual glob patterns (`@ai-life-os/*/src/*` and `@ai-life-os/*/*/src/*`) catch both direct and nested internal paths.

### Why Just task runner

Just provides cross-platform task orchestration with native Windows PowerShell support. The `just feature` command runs full verification (type-check + lint + test + build) in one step, mirroring CI checks locally. This gives AI agents a single command to verify their work without learning Turborepo internals.

### Tradeoffs Made

- **More initial setup files** (CLAUDE.md in each package) vs. long-term agent efficiency. We accept upfront cost for faster iteration.
- **Docker dependency for tests** vs. real integration confidence. In-memory mocks are faster but miss Supabase-specific behavior (RLS policies, triggers).
- **Multiple CLAUDE.md files to maintain** vs. context efficiency. Duplication is acceptable; each package documents its own scope.
- **Mastra dependency** vs. building agent infrastructure from scratch. We accept framework coupling for faster time-to-market and built-in streaming/tool support.
- **ESLint over TypeScript project references**: Gained immediate editor feedback; lost compile-time enforcement. TypeScript refs can be added later if needed.
- **contracts package maintenance overhead** vs. single source of truth. Extra package to maintain but eliminates scattered type definitions.
- **Just over Make**: Gained Windows compatibility and simpler syntax; lost ubiquity (Make more widely known).

## Invariants

1. **Each package must have working `pnpm test` command**: All packages run tests in CI. Missing or broken tests block merges.
2. **All tests must produce JSON output for agent parsing**: Use `vitest --reporter=json` so agents can interpret test failures programmatically.
3. **CLAUDE.md size is flexible, prioritize completeness over brevity**: Navigation accuracy matters more than token count.
4. **No circular dependencies between packages**: Enforced by pnpm workspace constraints. `contracts` is a leaf node with zero dependencies; all other packages may import from it.
5. **Missing SUPABASE env vars must throw at startup (fail fast)**: If `SUPABASE_URL` or `SUPABASE_ANON_KEY` are undefined, the app throws immediately in `createClient()`. This prevents runtime errors deep in the call stack.
6. **contracts has no internal dependencies**: Must remain leaf node in dependency graph. Never add dependencies to contracts package.
7. **Public API = index.ts exports only**: All cross-package imports use barrel exports. ESLint enforces this via no-restricted-imports rules.
8. **CLAUDE.md = pure index (tabular format)**: No prose, explanations, or design decisions. Use README.md for invisible knowledge.
