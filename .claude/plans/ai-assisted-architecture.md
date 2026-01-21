# AI-Assisted Development Architecture

## Overview

Implement modular architecture enabling multiple AI code assistants to work in parallel on isolated modules. The solution includes:
1. **packages/contracts** — shared Zod schemas and types
2. **ESLint boundaries** — enforcement preventing internal imports
3. **pnpm ai:verify** — self-verification script for AI agents
4. **doc-sync integration** — CLAUDE.md/README.md hierarchy per existing workflow
5. **Zod generation skill** — automatic contract generation from documentation
6. **Just task runner** — single command to complete features

Chosen approach: Standard + contracts package (user-specified). Boundaries enforced at lint time, contracts provide type-safe interfaces between modules. Integrates with existing doc-sync workflow instead of creating duplicate documentation hierarchy.

## Planning Context

### Decision Log

| Decision | Reasoning Chain |
|----------|-----------------|
| doc-sync integration (not new docs) | Existing doc-sync skill maintains CLAUDE.md/README.md hierarchy -> creating MODULES.md/MODULE.md duplicates this structure -> use existing workflow to update CLAUDE.md (index) and README.md (invisible knowledge) per package -> maintains single source of truth |
| Just for task orchestration | Cross-platform (Windows PowerShell support) -> simple syntax -> works alongside Turborepo -> no lock-in (plain shell scripts) -> alternative to Make which has Windows compatibility issues |
| Zod generation skill | Documentation-first workflow -> README.md describes domain models -> skill generates Zod schemas from README.md descriptions -> maintains sync between docs and contracts -> reduces manual schema maintenance |
| Barrel exports via index.ts | Single entry point per module -> ESLint can enforce imports only from index.ts -> prevents deep imports that bypass public API -> already partially implemented in codebase |
| ESLint no-restricted-imports | Native ESLint rule -> no new dependencies -> patterns support glob matching -> can block `@ai-life-os/*/src/*` while allowing `@ai-life-os/*` |
| contracts package now | Shared types needed across packages -> no existing Zod schemas in codebase (verified: packages/ai has no schemas) -> M1 creates canonical schemas from scratch -> establishes contract patterns before feature development |
| Zod for contracts | Runtime validation + TypeScript inference -> single source of truth -> Zod is industry standard for TypeScript schema validation -> integrates with tRPC, React Hook Form, etc. |
| New schemas (not migration) | Explored packages/ai: no existing Zod schemas found -> M1 creates ChatMessageSchema and AssistantSchema as new canonical contracts -> schema design based on ai-life-os-vision.md domain model (assistants, chats, messages) -> no migration needed |
| pnpm ai:verify composite | AI agents need one command to verify work -> combines type-check + lint + test -> fast feedback loop -> mirrors CI checks locally |
| Property-based boundary tests | Few tests cover many import path variations -> fast-check already in project -> generates edge cases humans miss -> higher confidence than example-based |
| Dual glob patterns for boundaries | Single pattern `@ai-life-os/*/src/*` blocks `@ai-life-os/ui/src/Button` -> but NOT `@ai-life-os/ui/lib/src/utils` (scoped subpath) -> second pattern `@ai-life-os/*/*/src/*` catches nested src directories like `@ai-life-os/ui/lib/src/utils` -> both patterns required for complete coverage |
| Root index.ts for contracts | contracts package exports from root index.ts (not src/index.ts) -> avoids conflict with ESLint boundary rule blocking `@ai-life-os/*/src/*` -> imports use `@ai-life-os/contracts` which resolves to index.ts -> no boundary violation |
| ESLint error immediately (user-specified) | User chose strict enforcement -> no warning phase -> violations block CI immediately -> prevents any internal imports from being committed |

### Rejected Alternatives

| Alternative | Why Rejected |
|-------------|--------------|
| MODULES.md + MODULE.md (original plan) | Duplicates existing doc-sync workflow -> CLAUDE.md already serves as navigation index -> README.md already captures invisible knowledge -> maintaining two parallel documentation systems creates drift |
| Make for task orchestration | Windows compatibility issues (requires MSYS2/WSL) -> complex syntax for simple tasks -> Just provides same functionality with native Windows support |
| Nx module boundaries (@nx/enforce-module-boundaries) | Requires migration to Nx -> significant tooling change -> Turborepo already in place -> ESLint rules achieve same goal with less disruption |
| TypeScript project references for boundaries | Compile-time only -> no runtime feedback -> ESLint provides immediate editor feedback -> project refs can be added later if needed |
| Manual boundary enforcement (honor system) | No automated verification -> AI agents could still import internal paths -> violations discovered late -> ESLint catches at lint time |
| contracts in apps/web only | Types scattered across consumers -> no single source of truth -> changes require updating multiple places -> centralized package cleaner |

### Constraints & Assumptions

- **Existing structure**: Turborepo + pnpm workspace already configured
- **Naming convention**: @ai-life-os/* namespace established
- **Build system**: turbo.json pipelines for dev, build, type-check, lint
- **Testing**: Vitest + fast-check (property-based) already in use
- **Applied defaults**: `<default-conventions domain="testing">` — property-based for boundary tests
- **Schema inventory**: Explored packages/ai — NO existing Zod schemas found. Files present: config.ts, prompts.ts, index.ts (exports config, mastra, models). M1 creates schemas from scratch, no migration required.

### Known Risks

| Risk | Mitigation | Anchor |
|------|------------|--------|
| ESLint rule too strict (blocks valid imports) | Rule starts as error (user-specified strict enforcement); if false positives found, add specific exceptions to patterns rather than downgrading severity | N/A — new rule |
| contracts package creates circular deps | contracts has no internal deps, leaf node in graph | N/A — new package |
| CLAUDE.md/README.md drift | doc-sync skill provides audit + verification phases; TW agent updates during plan execution | .claude/skills/doc-sync/SKILL.md |
| Schema design mismatch with future needs | Schema fields derived from ai-life-os-vision.md domain model; schemas are additive (new fields can be added without breaking existing) | N/A — design decision |
| Zod generation produces incorrect schemas | Generated schemas require human review; property-based tests validate schema behavior; skill output is additive (doesn't delete existing) | N/A — new skill |
| Just adds another tool to learn | Simple syntax (shell-like); justfile is self-documenting with comments; fallback to pnpm scripts always available | N/A — new tool |

## Invisible Knowledge

### Architecture

```
                    ┌─────────────────┐
                    │   apps/web      │
                    │  (Next.js app)  │
                    └────────┬────────┘
                             │ imports from
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
    ┌───────────┐    ┌───────────┐    ┌───────────┐
    │ @ai/      │    │ @supabase │    │ @ui       │
    │ packages/ │    │ packages/ │    │ packages/ │
    │ ai        │    │ supabase  │    │ ui        │
    └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
          │                │                │
          └────────────────┼────────────────┘
                           ▼
                  ┌─────────────────┐
                  │  @contracts     │
                  │  packages/      │
                  │  contracts      │
                  └─────────────────┘
                        (leaf)
```

### Data Flow (AI Agent Perspective)

```
AI Agent starts task
        │
        ▼
┌─────────────────┐
│ Read CLAUDE.md  │  ← Navigate to relevant files
│ (auto-loaded)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Read README.md  │  ← Understand architecture, decisions
│ of target pkg   │     (invisible knowledge)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Implement in    │  ← Modify only files in scope
│ module scope    │     Import from index.ts only
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ just feature    │  ← Single command: test + lint + build
│ (or ai:verify)  │
└────────┬────────┘
         │
    ┌────┴────┐
    │ Pass?   │
    └────┬────┘
    Yes  │  No → Fix violations → Re-run
         ▼
┌─────────────────┐
│ doc-sync update │  ← TW agent updates CLAUDE.md/README.md
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Task complete   │
└─────────────────┘
```

### Why This Structure

- **CLAUDE.md as entry point**: Auto-loaded by Claude Code; tabular index navigates to relevant files without loading everything
- **README.md per package**: Captures invisible knowledge (architecture, decisions, invariants) not visible from code
- **contracts as leaf node**: Zero internal dependencies prevents circular imports; all other packages can safely import
- **ESLint enforcement**: Catches violations at edit time (editor integration) rather than build time; immediate feedback
- **Just for orchestration**: Single command (`just feature`) runs full verification; cross-platform; works with existing Turborepo

### Invariants

1. **contracts has no internal dependencies** — must remain leaf node in dependency graph
2. **Public API = index.ts exports only** — all module consumers import from index.ts
3. **CLAUDE.md = pure index** — tabular format only; no prose (per doc-sync convention)
4. **README.md = invisible knowledge** — architecture, decisions, invariants not visible from code

### Tradeoffs

| Choice | Gained | Lost |
|--------|--------|------|
| ESLint over TypeScript refs | Editor feedback, existing tooling | Compile-time enforcement |
| contracts package | Single source of truth | Extra package to maintain |
| doc-sync over custom docs | Reuses existing workflow, no duplication | Must follow doc-sync conventions |
| Just over Make | Windows compatibility, simple syntax | Less ubiquitous than Make |
| Zod generation skill | Docs-to-code automation | Generated code needs review |

## Milestones

### Milestone 1: contracts Package Foundation

**Files**:
- `packages/contracts/package.json`
- `packages/contracts/tsconfig.json`
- `packages/contracts/index.ts`
- `packages/contracts/src/schemas/chat.schema.ts`
- `packages/contracts/src/schemas/assistant.schema.ts`
- `packages/contracts/src/schemas/index.ts`
- `pnpm-workspace.yaml` (verify includes packages/*)

**Flags**: `conformance`

**Requirements**:
- Create new package @ai-life-os/contracts
- Export Zod schemas for Chat, Assistant, Message
- TypeScript strict mode enabled
- Package builds without errors

**Acceptance Criteria**:
- `pnpm --filter @ai-life-os/contracts build` succeeds
- `pnpm --filter @ai-life-os/contracts type-check` succeeds
- Schemas export types via `z.infer<typeof Schema>`

**Tests**:
- **Test files**: `packages/contracts/tests/schemas.test.ts`
- **Test type**: property-based
- **Backing**: default-derived
- **Scenarios**:
  - Normal: Valid objects pass schema validation
  - Edge: Empty strings, null values handled correctly
  - Error: Invalid types rejected with clear errors

**Code Intent**:
- New file `packages/contracts/package.json`: Standard package config with @ai-life-os/contracts name, exports field pointing to index.ts (root level to avoid ESLint boundary rule conflicts)
- New file `packages/contracts/tsconfig.json`: Extends tooling/typescript/base.json, composite true for references
- New file `packages/contracts/src/schemas/chat.schema.ts`: ChatMessageSchema with id, role, content, createdAt fields using Zod
- New file `packages/contracts/src/schemas/assistant.schema.ts`: AssistantSchema with id, name, model, systemPrompt fields
- New file `packages/contracts/src/schemas/index.ts`: Re-exports all schemas
- New file `packages/contracts/index.ts`: Barrel export of schemas and inferred types (root level to avoid ESLint src/* blocking pattern)

**Code Changes**:

```diff
--- /dev/null
+++ b/packages/contracts/package.json
@@ -0,0 +1,22 @@
+{
+  "name": "@ai-life-os/contracts",
+  "version": "0.0.0",
+  "private": true,
+  "main": "./index.ts",
+  "types": "./index.ts",
+  "exports": {
+    ".": "./index.ts"
+  },
+  "scripts": {
+    "build": "tsc",
+    "type-check": "tsc --noEmit",
+    "lint": "eslint .",
+    "test": "vitest run --reporter=json --outputFile=test-results.json",
+    "test:watch": "vitest"
+  },
+  "dependencies": {
+    "zod": "^3.23.8"
+  },
+  "devDependencies": {
+    "@ai-life-os/typescript-config": "workspace:*",
+    "vitest": "^3.0.5",
+    "fast-check": "^3.23.2",
+    "typescript": "^5.7.2"
+  }
+}
```

```diff
--- /dev/null
+++ b/packages/contracts/tsconfig.json
@@ -0,0 +1,12 @@
+{
+  "$schema": "https://json.schemastore.org/tsconfig",
+  "extends": "../../tooling/typescript/library.json",
+  "compilerOptions": {
+    "composite": true,
+    "outDir": "dist",
+    "rootDir": "src"
+  },
+  "include": ["src/**/*"],
+  "exclude": ["node_modules", "dist", "tests"]
+}
```

```diff
--- /dev/null
+++ b/packages/contracts/src/schemas/chat.schema.ts
@@ -0,0 +1,25 @@
+import { z } from 'zod';
+
+// Zod provides runtime validation + TypeScript inference
+// Single source of truth for chat message structure across packages
+export const ChatMessageSchema = z.object({
+  id: z.string().uuid(),
+  role: z.enum(['user', 'assistant', 'system']),
+  content: z.string(),
+  // z.string().datetime() validates strict ISO 8601 format for API string serialization
+  createdAt: z.string().datetime(),
+});
+
+export const ChatSchema = z.object({
+  id: z.string().uuid(),
+  assistantId: z.string().uuid(),
+  userId: z.string().uuid(),
+  messages: z.array(ChatMessageSchema),
+  // z.string().datetime() validates strict ISO 8601 format for API string serialization
+  createdAt: z.string().datetime(),
+});
+
+export type ChatMessage = z.infer<typeof ChatMessageSchema>;
+export type Chat = z.infer<typeof ChatSchema>;
```

```diff
--- /dev/null
+++ b/packages/contracts/src/schemas/assistant.schema.ts
@@ -0,0 +1,21 @@
+import { z } from 'zod';
+
+// Domain model: assistants with name, model, systemPrompt
+// Fields are additive - new fields can be added without breaking existing code
+export const AssistantSchema = z.object({
+  id: z.string().uuid(),
+  name: z.string().min(1),
+  model: z.string(),
+  systemPrompt: z.string().optional(),
+  userId: z.string().uuid(),
+  // z.string().datetime() validates strict ISO 8601 format for API string serialization
+  createdAt: z.string().datetime(),
+  // z.string().datetime() validates strict ISO 8601 format for API string serialization
+  updatedAt: z.string().datetime(),
+});
+
+export type Assistant = z.infer<typeof AssistantSchema>;
```

```diff
--- /dev/null
+++ b/packages/contracts/src/schemas/index.ts
@@ -0,0 +1,11 @@
+// Single entry point prevents deep imports from violating module boundaries
+export {
+  ChatMessageSchema,
+  ChatSchema,
+  type ChatMessage,
+  type Chat,
+} from './chat.schema.js';
+
+export {
+  AssistantSchema,
+  type Assistant,
+} from './assistant.schema.js';
```

```diff
--- /dev/null
+++ b/packages/contracts/index.ts
@@ -0,0 +1,2 @@
+// Public API - all other packages import from this entry point only
+export * from './src/schemas/index.js';
```

---

### Milestone 2: ESLint Module Boundaries

**Files**:
- `tooling/eslint/boundary.js`
- `tooling/eslint/base.js` (modify to include boundary rules)
- `tooling/eslint/tests/boundary.test.js`

**Flags**: `conformance`, `needs-rationale`

**Requirements**:
- Create ESLint rule configuration blocking internal imports
- Pattern: Allow `@ai-life-os/*`, block `@ai-life-os/*/src/*`
- Add to base ESLint config
- Boundary tests verify rule catches violations

**Acceptance Criteria**:
- `import { x } from '@ai-life-os/ui'` — allowed
- `import { x } from '@ai-life-os/ui/src/components/Button'` — error
- `pnpm lint` reports violations on internal imports
- Boundary tests pass

**Tests**:
- **Test files**: `tooling/eslint/tests/boundary.test.js`
- **Test type**: property-based
- **Backing**: user-specified (boundary tests)
- **Scenarios**:
  - Normal: Public imports pass lint
  - Edge: Nested paths like `@ai-life-os/ui/dist/index` handled
  - Error: Internal imports `@ai-life-os/*/src/*` blocked

**Code Intent**:
- New file `tooling/eslint/boundary.js`: Export ESLint config object with no-restricted-imports rule, patterns array blocking `@ai-life-os/*/src/*` and `@ai-life-os/*/*/src/*`
- Modify `tooling/eslint/base.js`: Import and spread boundary config into rules (Decision: "ESLint no-restricted-imports")
- New file `tooling/eslint/tests/boundary.test.js`: Use ESLint RuleTester, property-based generation of valid/invalid import paths

**Code Changes**:

```diff
--- /dev/null
+++ b/tooling/eslint/boundary.js
@@ -0,0 +1,20 @@
+// Dual patterns required: single glob misses nested src directories
+module.exports = {
+  rules: {
+    "no-restricted-imports": ["error", {
+      "patterns": [
+        {
+          "group": ["@ai-life-os/*/src/*"],
+          "message": "Import from package index only: '@ai-life-os/package-name' (not internal paths)."
+        },
+        {
+          "group": ["@ai-life-os/*/*/src/*"],
+          "message": "Import from package index only: '@ai-life-os/package-name' (not nested internal paths)."
+        }
+      ]
+    }]
+  }
+};
```

```diff
--- a/tooling/eslint/base.js
+++ b/tooling/eslint/base.js
@@ -1,3 +1,5 @@
+const boundary = require('./boundary.js');
+
 module.exports = {
   parser: "@typescript-eslint/parser",
   extends: [
@@ -33,5 +35,6 @@ module.exports = {
     "@typescript-eslint/strict-boolean-expressions": ["error", {
       "allowNullableBoolean": true
     }]
-  }
+  },
+  ...boundary
 };
```

```diff
--- /dev/null
+++ b/tooling/eslint/tests/boundary.test.js
@@ -0,0 +1,54 @@
+const { RuleTester } = require('eslint');
+const fc = require('fast-check');
+const { describe, it } = require('vitest');
+const noRestrictedImports = require('eslint/use-at-your-own-risk').builtinRules.get('no-restricted-imports');
+const boundaryConfig = require('../boundary.js');
+
+// Property-based tests generate edge cases and cover many import path variations
+describe('ESLint module boundary enforcement', () => {
+  const ruleTester = new RuleTester({
+    parserOptions: { ecmaVersion: 2022, sourceType: 'module' }
+  });
+
+  const ruleOptions = boundaryConfig.rules['no-restricted-imports'][1];
+
+  it('allows public imports from package index', () => {
+    fc.assert(
+      fc.property(
+        fc.constantFrom('ai', 'ui', 'supabase', 'contracts'),
+        (pkg) => {
+          const code = `import { x } from '@ai-life-os/${pkg}';`;
+          ruleTester.run('no-restricted-imports',
+            noRestrictedImports,
+            {
+              valid: [{ code, options: [ruleOptions] }],
+              invalid: []
+            }
+          );
+        }
+      )
+    );
+  });
+
+  it('blocks internal src imports', () => {
+    fc.assert(
+      fc.property(
+        fc.constantFrom('ai', 'ui', 'supabase', 'contracts'),
+        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('/')),
+        (pkg, file) => {
+          const code = `import { x } from '@ai-life-os/${pkg}/src/${file}';`;
+          ruleTester.run('no-restricted-imports',
+            noRestrictedImports,
+            {
+              valid: [],
+              invalid: [{
+                code,
+                options: [ruleOptions],
+                errors: [{ message: /Import from package index only/ }]
+              }]
+            }
+          );
+        }
+      )
+    );
+  });
+});
```

---

### Milestone 3: ai:verify Scripts

**Files**:
- `package.json` (root)
- `packages/ai/package.json`
- `packages/supabase/package.json`
- `packages/ui/package.json`
- `packages/contracts/package.json`
- `turbo.json`
- `scripts/package.json`
- `scripts/tests/ai-verify.test.ts`

**Flags**: none

**Requirements**:
- Add `ai:verify` script to root and each package
- Root script runs all packages in parallel via turbo
- Package script runs type-check + lint + test for that package
- turbo.json includes ai:verify task with correct dependencies

**Acceptance Criteria**:
- `pnpm ai:verify` from root runs verification on all packages
- `pnpm --filter @ai-life-os/ai ai:verify` runs for single package
- Exit code 0 on success, non-zero on any failure

**Tests**:
- **Test files**: `scripts/tests/ai-verify.test.ts`
- **Test type**: integration
- **Backing**: default-derived (test end-user verifiable behavior)
- **Scenarios**:
  - Normal: `pnpm ai:verify` exits 0 when all checks pass
  - Error: `pnpm ai:verify` exits non-zero when type-check fails
  - Error: `pnpm ai:verify` exits non-zero when lint fails
  - Error: `pnpm ai:verify` exits non-zero when test fails

**Code Intent**:
- Modify root `package.json`: Add `"ai:verify": "turbo run ai:verify"` to scripts
- Modify each package `package.json`: Add `"lint": "eslint ."` script (prerequisite for ai:verify), add `"ai:verify": "pnpm type-check && pnpm lint && pnpm test"` script
- Modify packages/ui/package.json: Add test scripts (not present) and vitest dependencies before adding ai:verify
- Modify `turbo.json`: Add ai:verify task to pipeline with dependsOn: ["^ai:verify"] for proper ordering
- New file `scripts/package.json`: Workspace package defining test dependencies (vitest, execa, typescript) for ai-verify.test.ts
- New file `scripts/tests/ai-verify.test.ts`: Integration test using execa to run pnpm ai:verify, verify exit codes for success and failure scenarios using temporary fixtures with intentional errors

**Code Changes**:

```diff
--- a/package.json
+++ b/package.json
@@ -11,7 +11,8 @@
     "test": "turbo test",
     "lint": "turbo lint",
     "type-check": "turbo type-check",
+    "ai:verify": "turbo run ai:verify",
     "logs": "docker compose logs -f",
     "logs:web": "docker compose logs -f web",
     "web:restart": "docker compose restart web",
```

```diff
--- a/packages/ai/package.json
+++ b/packages/ai/package.json
@@ -5,6 +5,8 @@
   "main": "./src/index.ts",
   "types": "./src/index.ts",
   "scripts": {
+    "lint": "eslint .",
+    "ai:verify": "pnpm type-check && pnpm lint && pnpm test",
     "test": "vitest run --reporter=json --outputFile=test-results.json",
     "test:watch": "vitest",
     "type-check": "tsc --noEmit"
```

```diff
--- a/packages/ui/package.json
+++ b/packages/ui/package.json
@@ -5,10 +5,15 @@
   "main": "./src/index.ts",
   "types": "./src/index.ts",
   "scripts": {
+    "test": "vitest run --reporter=json --outputFile=test-results.json",
+    "test:watch": "vitest",
+    "lint": "eslint .",
+    "ai:verify": "pnpm type-check && pnpm lint && pnpm test",
     "type-check": "tsc --noEmit"
   },
   "dependencies": {
@@ -16,6 +21,8 @@
   },
   "devDependencies": {
     "@ai-life-os/typescript-config": "workspace:*",
+    "vitest": "^3.0.5",
+    "fast-check": "^3.23.2",
     "typescript": "^5.7.2"
   }
 }
```

```diff
--- a/packages/supabase/package.json
+++ b/packages/supabase/package.json
@@ -5,6 +5,8 @@
   "main": "./src/index.ts",
   "types": "./src/index.ts",
   "scripts": {
+    "lint": "eslint .",
+    "ai:verify": "pnpm type-check && pnpm lint && pnpm test",
     "test": "vitest run --reporter=json --outputFile=test-results.json",
     "test:watch": "vitest",
     "type-check": "tsc --noEmit"
```


```diff
--- a/turbo.json
+++ b/turbo.json
@@ -18,6 +18,9 @@
     },
     "type-check": {
       "dependsOn": ["^type-check"]
+    },
+    "ai:verify": {
+      "dependsOn": ["^ai:verify"]
     }
   }
 }
```

```diff
--- /dev/null
+++ b/scripts/package.json
@@ -0,0 +1,14 @@
+{
+  "name": "@ai-life-os/scripts",
+  "version": "0.0.0",
+  "private": true,
+  "scripts": {
+    "test": "vitest run",
+    "test:watch": "vitest"
+  },
+  "devDependencies": {
+    "vitest": "^3.0.5",
+    "execa": "^8.0.0",
+    "typescript": "^5.7.2"
+  }
+}
```

```diff
--- /dev/null
+++ b/scripts/tests/ai-verify.test.ts
@@ -0,0 +1,144 @@
+import { describe, it, expect, afterEach } from 'vitest';
+import { execa } from 'execa';
+import { writeFile, mkdir, rm } from 'fs/promises';
+import { join } from 'path';
+import { tmpdir } from 'os';
+
+// Integration test verifies end-user observable behavior
+// Composite command (type-check + lint + test) provides fast feedback loop for AI agents
+describe('ai:verify script', () => {
+  const tmpDirs: string[] = [];
+
+  afterEach(async () => {
+    // Cleanup temp directories
+    await Promise.all(
+      tmpDirs.map(dir => rm(dir, { recursive: true, force: true }))
+    );
+    tmpDirs.length = 0;
+  });
+
+  it('exits 0 when all checks pass', async () => {
+    const result = await execa('pnpm', ['ai:verify'], {
+      cwd: process.cwd(),
+      reject: false
+    });
+
+    expect(result.exitCode).toBe(0);
+  }, 60000); // Allow time for full verification
+
+  it('exits non-zero when type-check fails', async () => {
+    // Create temporary package with type error
+    const tmpDir = join(tmpdir(), `ai-verify-test-${Date.now()}`);
+    tmpDirs.push(tmpDir);
+    await mkdir(tmpDir, { recursive: true });
+
+    await writeFile(
+      join(tmpDir, 'package.json'),
+      JSON.stringify({
+        name: 'test-pkg',
+        scripts: {
+          'ai:verify': 'pnpm type-check',
+          'type-check': 'tsc --noEmit'
+        }
+      })
+    );
+
+    await writeFile(
+      join(tmpDir, 'tsconfig.json'),
+      JSON.stringify({
+        compilerOptions: {
+          strict: true,
+          skipLibCheck: true
+        }
+      })
+    );
+
+    await writeFile(
+      join(tmpDir, 'test.ts'),
+      'const x: string = 123;' // Type error
+    );
+
+    const result = await execa('pnpm', ['ai:verify'], {
+      cwd: tmpDir,
+      reject: false
+    });
+
+    expect(result.exitCode).not.toBe(0);
+  });
+
+  it('exits non-zero when lint fails', async () => {
+    const tmpDir = join(tmpdir(), `ai-verify-test-lint-${Date.now()}`);
+    tmpDirs.push(tmpDir);
+    await mkdir(tmpDir, { recursive: true });
+
+    await writeFile(
+      join(tmpDir, 'package.json'),
+      JSON.stringify({
+        name: 'test-pkg',
+        scripts: {
+          'ai:verify': 'pnpm lint',
+          'lint': 'eslint .'
+        }
+      })
+    );
+
+    await writeFile(
+      join(tmpDir, '.eslintrc.json'),
+      JSON.stringify({
+        rules: {
+          'no-unused-vars': 'error'
+        },
+        parserOptions: { ecmaVersion: 2022 }
+      })
+    );
+
+    await writeFile(
+      join(tmpDir, 'test.js'),
+      'var unused = 1;' // Unused variable error
+    );
+
+    const result = await execa('pnpm', ['ai:verify'], {
+      cwd: tmpDir,
+      reject: false
+    });
+
+    expect(result.exitCode).not.toBe(0);
+  });
+
+  it('exits non-zero when test fails', async () => {
+    const tmpDir = join(tmpdir(), `ai-verify-test-fail-${Date.now()}`);
+    tmpDirs.push(tmpDir);
+    await mkdir(tmpDir, { recursive: true });
+
+    await writeFile(
+      join(tmpDir, 'package.json'),
+      JSON.stringify({
+        name: 'test-pkg',
+        scripts: {
+          'ai:verify': 'pnpm test',
+          'test': 'vitest run'
+        }
+      })
+    );
+
+    await writeFile(
+      join(tmpDir, 'test.test.js'),
+      `import { test, expect } from 'vitest';
+test('failing test', () => {
+  expect(1).toBe(2);
+});`
+    );
+
+    const result = await execa('pnpm', ['ai:verify'], {
+      cwd: tmpDir,
+      reject: false
+    });
+
+    expect(result.exitCode).not.toBe(0);
+  });
+
+  it('runs all packages in parallel via turbo', async () => {
+    const result = await execa('turbo', ['run', 'ai:verify', '--dry=json'], {
+      cwd: process.cwd(),
+      reject: false
+    });
+
+    const output = JSON.parse(result.stdout);
+    // Verify turbo detects ai:verify task in multiple packages
+    expect(output.tasks.length).toBeGreaterThan(1);
+    // Verify proper dependency ordering (^ai:verify)
+    expect(output.tasks.some((t: any) => t.dependsOn?.includes('ai:verify'))).toBe(true);
+  });
+});
```

---

### Milestone 4: Just Task Runner

**Files**:
- `justfile`
- `package.json` (root — add just scripts)

**Flags**: `needs-rationale`

**Requirements**:
- Install Just as dev dependency (via npm/cargo or direct install)
- Create justfile with recipes for common workflows
- Integrate with existing pnpm/turbo commands
- Cross-platform support (Windows PowerShell)

**Acceptance Criteria**:
- `just feature` runs full verification (type-check + lint + test + build)
- `just verify` runs ai:verify across all packages
- `just generate` runs code generation (db types, etc.)
- `just clean` removes build artifacts
- All recipes work on Windows (PowerShell) and Unix

**Tests**:
- **Test files**: `scripts/tests/justfile.test.ts`
- **Test type**: integration
- **Backing**: default-derived
- **Scenarios**:
  - Normal: `just feature` exits 0 when all checks pass
  - Error: `just feature` exits non-zero on any failure
  - Cross-platform: recipes execute on current platform

**Code Intent**:
- New file `justfile`: Task runner configuration with recipes for feature, verify, generate, clean, and package-specific workflows
- Modify root `package.json`: Add `"just:install"` script for bootstrapping Just

**Code Changes**:

```diff
--- /dev/null
+++ b/justfile
@@ -0,0 +1,52 @@
+# AI Life OS — Task Runner
+# Cross-platform task orchestration for AI-assisted development
+
+# Windows PowerShell compatibility
+set windows-shell := ["powershell", "-NoLogo", "-Command"]
+
+# Default recipe: show available commands
+default:
+    @just --list
+
+# Complete feature workflow: verify + build
+feature: verify build
+    @echo "Feature complete!"
+
+# Run full verification (type-check + lint + test)
+verify:
+    pnpm turbo run ai:verify
+
+# Type check all packages
+type-check:
+    pnpm turbo run type-check
+
+# Lint all packages
+lint:
+    pnpm turbo run lint
+
+# Run tests across all packages
+test:
+    pnpm turbo run test
+
+# Build all packages
+build:
+    pnpm turbo run build
+
+# Generate code (Supabase types, etc.)
+generate:
+    pnpm db:generate
+
+# Generate Zod contracts from documentation
+generate-contracts:
+    pnpm zod:generate
+
+# Clean build artifacts
+clean:
+    pnpm turbo run clean --force
+    rm -rf node_modules/.cache
+
+# Install dependencies
+install:
+    pnpm install
+
+# Run doc-sync to update CLAUDE.md/README.md hierarchy
+docs:
+    @echo "Use 'doc-sync' skill in Claude Code to sync documentation"
+```

```diff
--- a/package.json
+++ b/package.json
@@ -11,6 +11,7 @@
     "test": "turbo test",
     "lint": "turbo lint",
     "type-check": "turbo type-check",
     "ai:verify": "turbo run ai:verify",
+    "zod:generate": "echo 'Run zod-gen skill in Claude Code'",
     "logs": "docker compose logs -f",
```

---

### Milestone 5: Zod Generation Skill

**Files**:
- `.claude/skills/zod-gen/SKILL.md`
- `.claude/skills/zod-gen/README.md`
- `.claude/skills/zod-gen/resources/schema-template.md`

**Delegated to**: Self (skill creation)

**Requirements**:
- Create skill that reads README.md domain model descriptions
- Generates Zod schemas from documentation
- Outputs to packages/contracts/src/schemas/
- Maintains existing schemas (additive, not destructive)
- Includes property-based tests for generated schemas

**Acceptance Criteria**:
- Skill invoked with `"Use your zod-gen skill to generate contracts"`
- Reads domain model from README.md invisible knowledge
- Generates valid Zod schemas with z.infer types
- Generated schemas pass type-check and lint
- Skill is self-documenting (SKILL.md explains workflow)

**Code Intent**:
- New file `.claude/skills/zod-gen/SKILL.md`: Skill definition with workflow phases (Discovery, Analysis, Generation, Verification)
- New file `.claude/skills/zod-gen/README.md`: Invisible knowledge explaining skill design decisions
- New file `.claude/skills/zod-gen/resources/schema-template.md`: Template for generated schemas

**Code Changes**:

```diff
--- /dev/null
+++ b/.claude/skills/zod-gen/SKILL.md
@@ -0,0 +1,98 @@
+---
+name: zod-gen
+description: Generates Zod schemas from documentation. Use when user asks to generate contracts or sync schemas.
+---
+
+# Zod Generation Skill
+
+Generates Zod schemas from README.md domain model descriptions. Maintains sync
+between documentation (invisible knowledge) and code (contracts package).
+
+## Activation
+
+Invoke when user requests:
+- "generate contracts"
+- "sync schemas"
+- "create Zod schemas from docs"
+- "update contracts from README"
+
+## Workflow
+
+### Phase 1: Discovery
+
+Find README.md files containing domain model descriptions:
+
+```bash
+# Find README.md files with domain model sections
+grep -rl "## Domain Model\|## Data Model\|## Entities" --include="README.md" .
+```
+
+Parse domain model sections looking for:
+- Entity names (nouns: User, Chat, Message, Assistant)
+- Field descriptions (properties with types)
+- Relationships (references to other entities)
+- Constraints (required, optional, validation rules)
+
+### Phase 2: Analysis
+
+For each entity found:
+
+1. Check if schema exists in `packages/contracts/src/schemas/`
+2. Compare existing schema fields with documented fields
+3. Identify:
+   - New entities needing schemas
+   - Existing schemas needing new fields
+   - Documentation updates needed (schema has fields not in docs)
+
+### Phase 3: Generation
+
+For new/updated schemas:
+
+1. Use schema template from `resources/schema-template.md`
+2. Generate Zod schema with:
+   - z.object() for entities
+   - z.string().uuid() for IDs
+   - z.string().datetime() for timestamps
+   - z.enum() for fixed values
+   - z.array() for collections
+3. Export type via `z.infer<typeof Schema>`
+4. Add to index.ts barrel export
+
+### Phase 4: Verification
+
+After generation:
+
+1. Run `pnpm --filter @ai-life-os/contracts type-check`
+2. Run `pnpm --filter @ai-life-os/contracts lint`
+3. Run `pnpm --filter @ai-life-os/contracts test`
+4. Report any issues for manual resolution
+
+## Output Format
+
+```
+## Zod Generation Report
+
+### Scope: [README.md files analyzed]
+
+### Changes Made
+- CREATED: [list of new schema files]
+- UPDATED: [list of modified schema files]
+- SKIPPED: [entities with existing up-to-date schemas]
+
+### Verification
+- Type check: [PASS/FAIL]
+- Lint: [PASS/FAIL]
+- Tests: [PASS/FAIL]
+```
+
+## Constraints
+
+- NEVER delete existing schema fields (additive only)
+- ALWAYS use z.string().datetime() for timestamps
+- ALWAYS export both Schema and inferred Type
+- ALWAYS add to index.ts barrel export
+- Generated schemas require human review before commit
+
+## Reference
+
+See `resources/schema-template.md` for schema template.
+```

```diff
--- /dev/null
+++ b/.claude/skills/zod-gen/README.md
@@ -0,0 +1,35 @@
+# Zod Generation Skill
+
+This skill automates the documentation-to-code workflow for Zod schemas.
+
+## Why This Exists
+
+Manual schema maintenance creates drift between documentation (README.md domain
+models) and code (packages/contracts/). This skill bridges the gap by reading
+documented domain models and generating corresponding Zod schemas.
+
+## Design Decisions
+
+**Additive-only generation**: The skill never deletes existing schema fields.
+This prevents accidental data loss and allows schemas to have fields not yet
+documented (forward compatibility).
+
+**z.string().datetime() for timestamps**: Chosen over z.date() because JSON
+serializes dates as strings. API responses need string validation, not Date
+object validation.
+
+**Human review required**: Generated schemas are not auto-committed. The skill
+reports what was generated but requires human review before committing. This
+catches AI misinterpretations of documentation.
+
+## Workflow Integration
+
+This skill complements doc-sync:
+- **doc-sync**: Maintains CLAUDE.md/README.md hierarchy (docs → docs)
+- **zod-gen**: Generates contracts from README.md domain models (docs → code)
+
+The two skills form a bidirectional sync:
+1. Document domain model in README.md
+2. Run zod-gen to generate schemas
+3. doc-sync updates CLAUDE.md to reference new contracts
+```

```diff
--- /dev/null
+++ b/.claude/skills/zod-gen/resources/schema-template.md
@@ -0,0 +1,28 @@
+# Schema Template
+
+Use this template when generating new Zod schemas:
+
+```typescript
+import { z } from 'zod';
+
+// [Entity description from README.md]
+// Fields derived from: [source README.md path]
+export const [EntityName]Schema = z.object({
+  id: z.string().uuid(),
+  // [field description]
+  [fieldName]: [zodType],
+  // z.string().datetime() validates strict ISO 8601 format for API string serialization
+  createdAt: z.string().datetime(),
+  updatedAt: z.string().datetime(),
+});
+
+export type [EntityName] = z.infer<typeof [EntityName]Schema>;
+```
+
+## Zod Type Mapping
+
+| Documentation Type | Zod Type |
+|-------------------|----------|
+| string | z.string() |
+| number | z.number() |
+| boolean | z.boolean() |
+| UUID / ID | z.string().uuid() |
+| timestamp / datetime | z.string().datetime() |
+| enum / one of | z.enum(['value1', 'value2']) |
+| array of X | z.array(XSchema) |
+| optional | .optional() |
+| nullable | .nullable() |
+| min length | .min(n) |
+| max length | .max(n) |
+```

---

### Milestone 6: doc-sync Integration

**Files**:
- `CLAUDE.md` (root — update)
- `packages/contracts/CLAUDE.md` (new)
- `packages/contracts/README.md` (new)
- `packages/ai/README.md` (update if exists, else create)
- `packages/supabase/README.md` (update if exists, else create)
- `packages/ui/README.md` (update if exists, else create)

**Delegated to**: doc-sync skill (via TW agent)

**Requirements**:
- Run doc-sync skill to audit and update documentation hierarchy
- Each package gets CLAUDE.md (index) and README.md (invisible knowledge)
- Root CLAUDE.md updated with new packages/contracts entry
- Follows .claude/conventions/documentation.md format specification

**Acceptance Criteria**:
- All directories have CLAUDE.md with tabular index format
- README.md exists where invisible knowledge is present
- packages/contracts/README.md documents schema design decisions
- Root CLAUDE.md indexes contracts package
- No prose in CLAUDE.md files (per doc-sync convention)

**Code Intent**:
Documentation milestone using doc-sync skill workflow:
1. Discovery: Map directories needing CLAUDE.md verification
2. Audit: Check for drift and misplaced content
3. Migration: Move any explanatory content to README.md
4. Update: Create/update indexes with tabular format
5. Verification: Confirm complete coverage and correct structure

**Source Material**: `## Invisible Knowledge` section of this plan

---

## Milestone Dependencies

```
M1 (contracts) ──┬──> M2 (ESLint)
                 │
                 └──> M3 (ai:verify)
                           │
M4 (Just) ────────────────┤
                           │
M5 (zod-gen) ─────────────┤
                           │
                           ▼
                    M6 (doc-sync)
```

**Parallel execution waves**:
- Wave 1: M1 (contracts), M4 (Just), M5 (zod-gen skill) — independent
- Wave 2: M2 (ESLint), M3 (ai:verify) — depend on M1 for imports to test
- Wave 3: M6 (doc-sync) — depends on all others being complete
