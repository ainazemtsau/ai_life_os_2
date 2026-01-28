/**
 * Chat Workflow Integration Tests
 *
 * Tests the chat workflow with real Supabase database.
 * Requires: `pnpm start` to be running
 *
 * These tests verify:
 * 1. Messages are created in the database
 * 2. SSE meta event contains correct message IDs
 * 3. Message IDs in meta match actual database records
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { SSEEvent } from '@ai-life-os/contracts';
import { SSEEventSchema } from '@ai-life-os/contracts';
import {
  getTestClient,
  generateTestPrefix,
  createTestConversation,
  cleanupOldTestData,
  isSupabaseAvailable,
} from './setup';

// Mock the AI streaming part only
vi.mock('ai', () => ({
  streamText: vi.fn().mockImplementation(() => ({
    textStream: (async function* () {
      yield 'Hello ';
      yield 'World';
    })(),
  })),
}));

describe('Chat Workflow Integration', () => {
  const client = getTestClient();
  let testPrefix: string;
  let conversationId: string;
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
  });

  afterAll(async () => {
    if (!supabaseAvailable) return;
    // Final cleanup
    await cleanupOldTestData(client);
  });

  it('should create user and assistant messages in database', async () => {
    if (!supabaseAvailable) {
      console.log('Skipped: Supabase not available');
      return;
    }

    // Import dynamically to allow mocking
    const { chatWorkflow } = await import('@ai-life-os/ai');

    const events: SSEEvent[] = [];
    const generator = chatWorkflow({
      client: client as any,
      conversationId,
      content: 'Test message',
    });

    for await (const event of generator) {
      const validated = SSEEventSchema.safeParse(event);
      if (validated.success) {
        events.push(validated.data);
      }
    }

    // Should have meta, chunks, and complete events
    expect(events.length).toBeGreaterThanOrEqual(2);

    // First event should be meta with message IDs
    const metaEvent = events.find(e => e.type === 'meta');
    expect(metaEvent).toBeDefined();
    expect(metaEvent?.type).toBe('meta');

    if (metaEvent?.type === 'meta') {
      // Verify messages exist in database
      const { data: userMsg } = await client
        .from('messages')
        .select('*')
        .eq('id', metaEvent.userMessageId)
        .single();

      expect(userMsg).toBeDefined();
      expect(userMsg?.role).toBe('user');
      expect(userMsg?.content).toBe('Test message');
      expect(userMsg?.conversation_id).toBe(conversationId);

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

  it('should yield complete event with full content', async () => {
    if (!supabaseAvailable) {
      console.log('Skipped: Supabase not available');
      return;
    }

    const { chatWorkflow } = await import('@ai-life-os/ai');

    const events: SSEEvent[] = [];
    const generator = chatWorkflow({
      client: client as any,
      conversationId,
      content: 'Another test',
    });

    for await (const event of generator) {
      const validated = SSEEventSchema.safeParse(event);
      if (validated.success) {
        events.push(validated.data);
      }
    }

    // Last event should be complete
    const completeEvent = events.find(e => e.type === 'complete');
    expect(completeEvent).toBeDefined();
    expect(completeEvent?.type).toBe('complete');

    if (completeEvent?.type === 'complete') {
      expect(completeEvent.content).toBe('Hello World');
    }
  });

  it('should set correct parent-child relationship', async () => {
    if (!supabaseAvailable) {
      console.log('Skipped: Supabase not available');
      return;
    }

    const { chatWorkflow } = await import('@ai-life-os/ai');

    const events: SSEEvent[] = [];
    const generator = chatWorkflow({
      client: client as any,
      conversationId,
      content: 'Parent test',
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
      // User message should have null parent (root)
      const { data: userMsg } = await client
        .from('messages')
        .select('parent_id')
        .eq('id', metaEvent.userMessageId)
        .single();

      expect(userMsg?.parent_id).toBeNull();

      // Assistant message should have user message as parent
      const { data: assistantMsg } = await client
        .from('messages')
        .select('parent_id')
        .eq('id', metaEvent.assistantMessageId)
        .single();

      expect(assistantMsg?.parent_id).toBe(metaEvent.userMessageId);
    }
  });
});
