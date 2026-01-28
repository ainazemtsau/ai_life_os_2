import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    reporters: ['json'],
    outputFile: 'test-results.json',
    coverage: { provider: 'v8' },
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    // Run integration tests sequentially to avoid DB conflicts
    sequence: {
      concurrent: false,
    },
    // Each test file runs sequentially
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@ai-life-os/contracts': path.resolve(__dirname, '../../packages/contracts/src'),
      '@ai-life-os/ai': path.resolve(__dirname, '../../packages/ai/src'),
      '@ai-life-os/supabase': path.resolve(__dirname, '../../packages/supabase/src'),
    },
  },
});
