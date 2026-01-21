import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    reporters: ['json'],
    outputFile: 'test-results.json',
    coverage: { provider: 'v8' },
  },
});
