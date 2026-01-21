# ESLint Configuration

## Overview

Shared ESLint configuration enforcing module boundaries through import restrictions. Prevents internal imports that bypass public APIs, ensuring all inter-package imports use index.ts barrel exports.

## Design Decisions

**Dual glob patterns**: Single pattern `@ai-life-os/*/src/*` blocks direct src imports like `@ai-life-os/ui/src/Button`. However, it does NOT catch nested scoped paths like `@ai-life-os/ui/lib/src/utils`. The second pattern `@ai-life-os/*/*/src/*` catches these nested cases. Both patterns required for complete coverage.

**ESLint over TypeScript project references**: TypeScript refs provide compile-time enforcement only. ESLint provides immediate editor feedback when imports are typed, catching violations at edit time rather than build time.

**Error severity (not warning)**: User-specified strict enforcement. Violations block CI immediately, preventing internal imports from being committed.

**Property-based boundary tests**: Few property-based tests cover many import path variations using fast-check. Generates edge cases humans would miss (nested paths, scoped packages, multiple depth levels).

## Invariants

1. All cross-package imports must use barrel exports (index.ts)
2. Patterns block any path containing `/src/` segment
3. Boundary rules apply to all packages under @ai-life-os namespace
