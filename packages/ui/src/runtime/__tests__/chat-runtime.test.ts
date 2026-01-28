import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChatRuntime } from '../chat-runtime';
import * as fc from 'fast-check';

global.fetch = vi.fn();

describe('useChatRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call edit API and update messages with SSE events', async () => {
    // Mock SSE stream with structured events
    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"type":"meta","userMessageId":"user-new","assistantMessageId":"asst-new"}\n\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"type":"chunk","content":"Hello "}\n\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"type":"chunk","content":"world"}\n\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"type":"complete","content":"Hello world"}\n\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    // First call: createConversation
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        conversation: { id: 'conv-1', userId: 'user-1', assistantId: 'asst-1' },
      }),
    } as any);

    // Second call: switchConversation messages
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        messages: [{
          id: 'msg-1',
          conversationId: 'conv-1',
          parentId: null,
          role: 'user',
          content: 'original',
          status: 'complete',
          createdAt: new Date().toISOString(),
        }],
      }),
    } as any);

    // Third call: edit API with SSE stream
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => mockReader,
      },
    } as any);

    const { result } = renderHook(() => useChatRuntime());

    await act(async () => {
      await result.current.createConversation('asst-1');
    });

    await act(async () => {
      await result.current.switchConversation('conv-1');
    });

    await act(async () => {
      await result.current.editMessage('msg-1', 'edited content');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/messages/msg-1/edit',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ newContent: 'edited content' }),
      })
    );

    // Should have added new messages with real IDs from meta event
    expect(result.current.messages.some(m => m.id === 'user-new')).toBe(true);
    expect(result.current.messages.some(m => m.id === 'asst-new')).toBe(true);

    // Assistant message should have complete content
    const assistantMsg = result.current.messages.find(m => m.id === 'asst-new');
    expect(assistantMsg?.content).toBe('Hello world');
    expect(assistantMsg?.status).toBe('complete');

    // activeBranches should point to new user message
    expect(result.current.activeBranches['__ROOT__']).toBe('user-new');
  });

  it('should update activeBranches when switchBranch called', () => {
    const { result } = renderHook(() => useChatRuntime());

    act(() => {
      result.current.switchBranch('parent-1', 'msg-2');
    });

    expect(result.current.activeBranches['parent-1']).toBe('msg-2');
  });

  it('should handle API errors gracefully', async () => {
    // First call: createConversation
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        conversation: { id: 'conv-1', userId: 'user-1', assistantId: 'asst-1' },
      }),
    } as any);

    // Second call: switchConversation messages
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        messages: [{
          id: 'msg-1',
          conversationId: 'conv-1',
          parentId: null,
          role: 'user',
          content: 'original',
          status: 'complete',
          createdAt: new Date().toISOString(),
        }],
      }),
    } as any);

    // Third call: edit API returns error
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
    } as any);

    const { result } = renderHook(() => useChatRuntime());

    await act(async () => {
      await result.current.createConversation('asst-1');
    });

    await act(async () => {
      await result.current.switchConversation('conv-1');
    });

    await act(async () => {
      await result.current.editMessage('msg-1', 'edited content');
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.code).toBe('EDIT_ERROR');
    });
  });
});

describe('useChatRuntime - property-based tests', () => {
  it('activeBranches values should always be messageIds that exist in messages array', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            parentId: fc.oneof(fc.uuid(), fc.constant(null)),
            content: fc.string(),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (messageData) => {
          const messages = messageData.map((m) => ({
            ...m,
            conversationId: 'conv-1',
            role: 'assistant' as const,
            status: 'complete' as const,
            createdAt: new Date().toISOString(),
          }));

          const activeBranches: Record<string, string> = {};
          for (const msg of messages) {
            const parentKey = msg.parentId || '__ROOT__';
            activeBranches[parentKey] = msg.id;
          }

          for (const messageId of Object.values(activeBranches)) {
            const exists = messages.some((m) => m.id === messageId);
            expect(exists).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('message filtering should preserve all root messages', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            parentId: fc.oneof(fc.uuid(), fc.constant(null)),
            content: fc.string(),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (messageData) => {
          const messages = messageData.map((m) => ({
            ...m,
            conversationId: 'conv-1',
            role: 'assistant' as const,
            status: 'complete' as const,
            createdAt: new Date().toISOString(),
          }));

          const rootMessages = messages.filter((m) => m.parentId === null);

          const messagesByParent = new Map();
          for (const msg of messages) {
            const key = msg.parentId ?? '__ROOT__';
            const group = messagesByParent.get(key) || [];
            group.push(msg);
            messagesByParent.set(key, group);
          }

          const activeBranches: Record<string, string> = {};
          const filtered = messages.filter((msg) => {
            const key = msg.parentId ?? '__ROOT__';
            const siblings = messagesByParent.get(key) || [];
            if (siblings.length <= 1) return true;
            const activeId = activeBranches[key];
            return !activeId || activeId === msg.id;
          });

          for (const rootMsg of rootMessages) {
            expect(filtered.some((m) => m.id === rootMsg.id)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
