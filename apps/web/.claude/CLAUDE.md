# @ai-life-os/web

Next.js 15 App Router chat application.

## Index

| File                 | What                          | When to read                              |
| -------------------- | ----------------------------- | ----------------------------------------- |
| `package.json`       | Dependencies, build scripts   | Modifying dependencies, scripts           |
| `next.config.ts`     | Next.js configuration         | Changing build settings, transpilePackages |
| `tailwind.config.ts` | Tailwind configuration        | Modifying theme, adding utilities         |
| `postcss.config.js`  | PostCSS configuration         | Modifying CSS processing                  |
| `tsconfig.json`      | TypeScript Next.js configuration | Modifying TypeScript settings          |
| `vitest.config.ts`   | Vitest test configuration     | Modifying test setup, JSON reporter       |
| `tests/setup.test.ts` | Integration tests for workspace imports | Writing tests, verifying package resolution |

## Subdirectories

| Directory      | What                          | When to read                              |
| -------------- | ----------------------------- | ----------------------------------------- |
| `app/`         | Next.js App Router pages, layouts, API routes | Building pages, API routes, layouts |
| `lib/`         | Utility functions (cn, etc.)  | Adding utilities, modifying helpers       |
| `tests/`       | Integration tests             | Writing tests, verifying package imports  |
