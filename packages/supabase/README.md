# @ai-life-os/supabase

## Overview

Database client and authentication layer for Supabase. Provides factory functions for creating browser and server Supabase clients, plus Next.js middleware for session refresh. Enforces Row Level Security (RLS) policies through server-side clients.

## Architecture

Three entry points with distinct responsibilities:

- **`createClient()`**: Browser client for client-side operations (chat UI, realtime subscriptions). Uses `localStorage` for session persistence.
- **`createServerClient(cookies)`**: Server client for Server Components and Actions. Requires cookie access for session handling. Enforces RLS policies based on authenticated user.
- **`updateSession(request, response)`**: Middleware for refreshing Supabase sessions. Extends session expiry on each request to prevent unexpected logouts.

## Design Decisions

### Why separate browser and server clients

Supabase sessions are stored in cookies for server-side rendering, but cookies are not directly accessible in browser contexts. The browser client uses `localStorage` while the server client requires explicit cookie handlers. This separation ensures correct session handling in each environment.

### Why middleware for session refresh

Supabase access tokens expire after 1 hour. Without refresh, users get logged out mid-session. The middleware (`updateSession`) refreshes tokens on every request, extending the session transparently. This must run before any server-side Supabase calls.

### Why RLS enforcement on server

Client-side Supabase clients can be manipulated in browser DevTools. RLS policies are the source of truth for authorization, but they only apply if queries go through an authenticated server client. All mutations and sensitive queries must use `createServerClient()` to enforce user isolation.

### Why generated types (Database type)

Supabase CLI generates TypeScript types from the database schema (`pnpm db:generate`). This ensures queries are type-safe and prevents typos in table/column names. The generated `Database` type is re-exported from this package for use in Server Actions and API routes.

## Invariants

1. **Server clients must receive cookie handlers**: `createServerClient()` requires `cookies()` from `next/headers`. Missing cookies will break session persistence.
2. **Middleware must run on all authenticated routes**: Next.js middleware config must match routes requiring auth. Exclude public routes (`/login`, `/signup`) to avoid redirect loops.
3. **Environment variables must be set at startup**: `SUPABASE_URL` and `SUPABASE_ANON_KEY` are required. Missing vars throw immediately in `createClient()` (fail-fast strategy).
4. **Tests must run against real Supabase instance**: In-memory mocks do not test RLS policies or triggers. Use Docker Compose to spin up local Supabase for tests.
5. **Session refresh errors must not break page load**: If `updateSession()` fails (network error, invalid token), the middleware returns the original response. Do not block requests on refresh failures.
