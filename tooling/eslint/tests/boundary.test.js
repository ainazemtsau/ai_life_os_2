const { Linter } = require('eslint');
const { describe, it, expect, beforeEach, test } = require('vitest');
const fc = require('fast-check');
const boundaryConfig = require('../boundary.js');

describe('ESLint Module Boundary Rules', () => {
  let linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('allows imports from package index', () => {
    const code = `import { Component } from '@ai-life-os/ui';`;
    const messages = linter.verify(code, boundaryConfig, { filename: 'test.ts' });
    expect(messages).toHaveLength(0);
  });

  it('blocks direct src/ imports', () => {
    const code = `import { Button } from '@ai-life-os/ui/src/components/Button';`;
    const messages = linter.verify(code, boundaryConfig, { filename: 'test.ts' });
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toContain('Import from package index only');
  });

  test('property: all valid package imports pass', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('ui', 'ai', 'supabase', 'contracts'),
        (pkg) => {
          const code = `import { x } from '@ai-life-os/${pkg}';`;
          const messages = linter.verify(code, boundaryConfig, { filename: 'test.ts' });
          expect(messages).toHaveLength(0);
        }
      )
    );
  });

  test('property: src imports are blocked', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('ui', 'ai', 'supabase', 'contracts'),
        fc.stringMatching(/^[a-z]+$/),
        (pkg, file) => {
          const code = `import { x } from '@ai-life-os/${pkg}/src/${file}';`;
          const messages = linter.verify(code, boundaryConfig, { filename: 'test.ts' });
          expect(messages.length).toBeGreaterThan(0);
        }
      )
    );
  });
});
