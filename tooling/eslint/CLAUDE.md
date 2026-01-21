# tooling/eslint/

Shared ESLint configuration with module boundary enforcement.

## Files

| File                    | What                              | When to read                               |
| ----------------------- | --------------------------------- | ------------------------------------------ |
| `package.json`          | ESLint plugin dependencies        | Adding lint plugins, updating versions     |
| `base.js`               | Base ESLint config with boundaries| Modifying lint rules, adding checks        |
| `boundary.js`           | Module boundary import restrictions| Changing allowed import patterns          |
| `tests/boundary.test.js`| Property-based boundary tests     | Debugging boundary rules, adding test cases|
