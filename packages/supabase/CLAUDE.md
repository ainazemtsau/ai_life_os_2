# Supabase Package

Database client, auth middleware, and query functions for PostgreSQL.

## Files

| File | What | When to read |
|------|------|--------------|
| `README.md` | Database schema, RLS policies, query patterns | Understanding database design, auth setup |
| `package.json` | Dependencies, scripts | Adding database dependencies |
| `src/index.ts` | Package exports | Finding exported queries, types |
| `src/client.ts` | Supabase client factory | Setting up database connection |
| `src/env.ts` | Environment configuration | Configuring Supabase URL, keys |
| `src/middleware.ts` | Session middleware for Next.js | Adding auth to API routes |
| `src/types.ts` | Auto-generated database types | Working with table schemas |

## Subdirectories

| Directory | What | When to read |
|-----------|------|--------------|
| `src/queries/` | Database query functions | Inserting/updating messages, conversations, usage metrics |
| `supabase/init/` | SQL init scripts for Docker | Modifying database schema, adding tables |
