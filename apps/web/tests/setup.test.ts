import { describe, it, expect } from 'vitest';

describe('Next.js setup', () => {
  it('workspace packages are accessible', async () => {
    await expect(import('@ai-life-os/ui')).resolves.toBeDefined();
  });
});
