# scripts/

Development automation and integration tests.

## Files

| File                      | What                              | When to read                               |
| ------------------------- | --------------------------------- | ------------------------------------------ |
| `package.json`            | Test dependencies (vitest, execa) | Adding test tools, updating versions       |
| `dev-full.sh`             | Start Supabase + dev server       | Setting up full development environment    |
| `test-json.sh`            | Run tests with JSON reporter      | Running tests for agent consumption        |
| `tests/ai-verify.test.ts` | Integration tests for ai:verify   | Debugging verification workflow            |
| `tests/justfile.test.ts`  | Integration tests for Just recipes| Debugging Just task orchestration          |
