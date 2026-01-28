/**
 * Branch Workflow Integration Tests
 *
 * Tests the branch workflow (message edit) with real Supabase database.
 * Requires: `pnpm start` to be running
 *
 * These tests verify:
 * 1. Editing creates a new branch (sibling message)
 * 2. New message has same parent as original
 * 3. SSE meta event contains correct IDs
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { SSEEvent } from '@ai-life-os/contracts';
import { SSEEventSchema } from '@ai-life-os/contracts';
import {
  getTestClient,
  generateTestPrefix,
  createTestConversation,
  createTestMessage,
  cleanupOldTestData,
  isSupabaseAvailable,
} from './setup';

// Mock the AI streaming part only
vi.mock('ai', () => ({
  streamText: vi.fn().mockImplementation(() => ({
    textStream: (async function* () {
      yield 'Edited ';
      yield 'response';
    })(),
  })),
}));

describe('Branch Workflow Integration', () => {
  const client = getTestClient();
  let testPrefix: string;
  let conversationId: string;
  let originalMessageId: string;
  let supabaseAvailable = false;

  beforeAll(async () => {
    supabaseAvailable = await isSupabaseAvailable();
    if (!supabaseAvailable) {
      console.warn('⚠️ Supabase not available. Run `pnpm start` first. Skipping integration tests.');
      return;
    }
    // Clean up any leftover test data from failed previous runs
    await cleanupOldTestData(client);
  });

  beforeEach(async () => {
    if (!supabaseAvailable) return;

    testPrefix = generateTestPrefix();
    conversationId = await createTestConversation(client, testPrefix);

    // Create an original user message to edit
    originalMessageId = await createTestMessage(
      client,
      conversationId,
      'Original message',
      'user',
      null
    );

    // Create original assistant response
    await createTestMessage(
      client,
      conversationId,
      'Original response',
      'assistant',
      originalMessageId
    );
  });

  afterAll(async () => {
    if (!supabaseAvailable) return;
    // Final cleanup
    await cleanupOldTestData(client);
  });

  it('should create sibling message when editing', async () => {
    if (!supabaseAvailable) {
      console.log('Skipped: Supabase not available');
      return;
    }

    const { branchWorkflow } = await import('@ai-life-os/ai');

    const events: SSEEvent[] = [];
    const generator = branchWorkflow({
      client: client as any,
      originalMessageId,
      newContent: 'Edited message',
    });

    for await (const event of generator) {
      const validated = SSEEventSchema.safeParse(event);
      if (validated.success) {
        events.push(validated.data);
      }
    }

    const metaEvent = events.find(e => e.type === 'meta');
    expect(metaEvent?.type).toBe('meta');

    if (metaEvent?.type === 'meta') {
      // New user message should exist
      const { data: newUserMsg } = await client
        .from('messages')
        .select('*')
        .eq('id', metaEvent.userMessageId)
        .single();

      expect(newUserMsg).toBeDefined();
      expect(newUserMsg?.content).toBe('Edited message');
      expect(newUserMsg?.role).toBe('user');

      // New user message should have same parent as original (both are siblings)
      const { data: originalMsg } = await client
        .from('messages')
        .select('parent_id')
        .eq('id', originalMessageId)
        .single();

      expect(newUserMsg?.parent_id).toBe(originalMsg?.parent_id);
    }
  });

  it('should create new assistant response for edited message', async () => {
    if (!supabaseAvailable) {
      console.log('Skipped: Supabase not available');
      return;
    }

    const { branchWorkflow } = await import('@ai-life-os/ai');

    const events: SSEEvent[] = [];
    const generator = branchWorkflow({
      client: client as any,
      originalMessageId,
      newContent: 'Another edit',
    });

    for await (const event of generator) {
      const validated = SSEEventSchema.safeParse(event);
      if (validated.success) {
        events.push(validated.data);
      }
    }

    const metaEvent = events.find(e => e.type === 'meta');
    expect(metaEvent?.type).toBe('meta');

    if (metaEvent?.type === 'meta') {
      // New assistant message should have new user message as parent
      const { data: assistantMsg } = await client
        .from('messages')
        .select('*')
        .eq('id', metaEvent.assistantMessageId)
        .single();

      expect(assistantMsg).toBeDefined();
      expect(assistantMsg?.role).toBe('assistant');
      expect(assistantMsg?.parent_id).toBe(metaEvent.userMessageId);
    }
  });

  it('should preserve original branch (not delete original messages)', async () => {
    if (!supabaseAvailable) {
      console.log('Skipped: Supabase not available');
      return;
    }

    const { branchWorkflow } = await import('@ai-life-os/ai');

    // Count messages before edit
    const { count: beforeCount } = await client
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId);

    const generator = branchWorkflow({
      client: client as any,
      originalMessageId,
      newContent: 'Edit test',
    });

    for await (const _ of generator) {
      // Consume stream
    }

    // Count messages after edit
    const { count: afterCount } = await client
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId);

    // Should have 2 more messages (new user + new assistant)
    expect(afterCount).toBe((beforeCount ?? 0) + 2);

    // Original message should still exist
    const { data: originalMsg } = await client
      .from('messages')
      .select('id')
      .eq('id', originalMessageId)
      .single();

    expect(originalMsg).toBeDefined();
  });

  it('should return valid SSE event sequence', async () => {
    if (!supabaseAvailable) {
      console.log('Skipped: Supabase not available');
      return;
    }

    const { branchWorkflow } = await import('@ai-life-os/ai');

    const events: SSEEvent[] = [];
    const generator = branchWorkflow({
      client: client as any,
      originalMessageId,
      newContent: 'SSE test',
    });

    for await (const event of generator) {
      const validated = SSEEventSchema.safeParse(event);
      if (validated.success) {
        events.push(validated.data);
      }
    }

    // Should have: meta, chunks..., complete
    expect(events.length).toBeGreaterThanOrEqual(3);

    // First should be meta
    expect(events[0].type).toBe('meta');

    // Last should be complete
    expect(events[events.length - 1].type).toBe('complete');

    // Middle should be chunks
    const chunks = events.filter(e => e.type === 'chunk');
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });
});
