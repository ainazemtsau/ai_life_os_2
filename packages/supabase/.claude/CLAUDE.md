# @ai-life-os/supabase

Database client, authentication, and session middleware for Supabase.

## Index

| File                   | What                                   | When to read                                    |
| ---------------------- | -------------------------------------- | ----------------------------------------------- |
| `README.md`            | Architecture decisions, invariants     | Understanding design, fail-fast strategy        |
| `package.json`         | Dependencies, test scripts             | Adding Supabase dependencies, test setup        |
| `tsconfig.json`        | TypeScript library configuration       | Modifying TypeScript settings                   |
| `vitest.config.ts`     | Vitest test configuration              | Modifying test setup, JSON reporter             |
| `src/index.ts`         | Package exports                        | Understanding public API                        |
| `src/env.ts`           | Environment variable validation        | Modifying env var handling, error messages      |
| `src/client.ts`        | Browser Supabase client factory        | Client-side database/auth operations            |
| `src/server.ts`        | Server Supabase client factory         | Server-side database/auth operations, RLS       |
| `src/middleware.ts`    | Next.js session refresh middleware     | Setting up auth middleware, session handling    |
| `src/types.ts`         | Generated database types               | Type-safe database queries, schema reference    |
| `tests/client.test.ts` | Property-based tests for client setup  | Writing tests, TDD workflow, understanding edge cases |
