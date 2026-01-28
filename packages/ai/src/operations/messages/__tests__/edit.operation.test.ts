import { describe, it, expect, vi } from 'vitest';
import type { SSEEvent } from '@ai-life-os/contracts';
import { editMessageOperation } from '../edit.operation';
import * as branchWorkflow from '../../../workflows/branch.workflow';

vi.mock('../../../workflows/branch.workflow', () => ({
  branchWorkflow: vi.fn(),
}));

describe('editMessageOperation', () => {
  it('should call branchWorkflow with correct parameters and yield SSE events', async () => {
    const mockClient = {} as any;
    const mockGenerator = async function* (): AsyncGenerator<SSEEvent> {
      yield { type: 'meta', userMessageId: 'user-123', assistantMessageId: 'msg-123' };
      yield { type: 'chunk', content: 'test ' };
      yield { type: 'chunk', content: 'response' };
      yield { type: 'complete', content: 'test response' };
    };

    vi.mocked(branchWorkflow.branchWorkflow).mockReturnValue(
      mockGenerator() as any
    );

    const input = {
      client: mockClient,
      messageId: 'original-msg-id',
      newContent: 'edited content',
      abortSignal: new AbortController().signal,
    };

    const generator = editMessageOperation(input);
    const results: SSEEvent[] = [];
    for await (const event of generator) {
      results.push(event);
    }

    expect(branchWorkflow.branchWorkflow).toHaveBeenCalledWith({
      client: mockClient,
      originalMessageId: 'original-msg-id',
      newContent: 'edited content',
      abortSignal: input.abortSignal,
    });
    expect(results).toHaveLength(4);
    expect(results[0]).toEqual({ type: 'meta', userMessageId: 'user-123', assistantMessageId: 'msg-123' });
    expect(results[1]).toEqual({ type: 'chunk', content: 'test ' });
    expect(results[2]).toEqual({ type: 'chunk', content: 'response' });
    expect(results[3]).toEqual({ type: 'complete', content: 'test response' });
  });

  it('should handle empty content', async () => {
    const mockClient = {} as any;
    const mockGenerator = async function* (): AsyncGenerator<SSEEvent> {
      yield { type: 'meta', userMessageId: 'user-123', assistantMessageId: 'msg-123' };
      yield { type: 'complete', content: '' };
    };

    vi.mocked(branchWorkflow.branchWorkflow).mockReturnValue(
      mockGenerator() as any
    );

    const input = {
      client: mockClient,
      messageId: 'original-msg-id',
      newContent: '',
    };

    const generator = editMessageOperation(input);
    const results: SSEEvent[] = [];
    for await (const event of generator) {
      results.push(event);
    }

    expect(branchWorkflow.branchWorkflow).toHaveBeenCalledWith({
      client: mockClient,
      originalMessageId: 'original-msg-id',
      newContent: '',
      abortSignal: undefined,
    });
    expect(results).toHaveLength(2);
    expect(results[0].type).toBe('meta');
    expect(results[1]).toEqual({ type: 'complete', content: '' });
  });

  it('should propagate errors from branchWorkflow', async () => {
    const mockClient = {} as any;
    const mockGenerator = async function* (): AsyncGenerator<SSEEvent> {
      throw new Error('Workflow error');
    };

    vi.mocked(branchWorkflow.branchWorkflow).mockReturnValue(
      mockGenerator() as any
    );

    const input = {
      client: mockClient,
      messageId: 'invalid-id',
      newContent: 'content',
    };

    const generator = editMessageOperation(input);

    await expect(async () => {
      for await (const event of generator) {
        // Should throw before yielding
      }
    }).rejects.toThrow('Workflow error');
  });
});
