import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageList } from '../message-list';
import type { Message } from '@ai-life-os/contracts';

// Mock runtime with controllable state
const mockRuntimeState = {
  messages: [] as Message[],
  activeBranches: {} as Record<string, string>,
  siblingsCache: {} as Record<string, Message[]>,
  editMessage: vi.fn(),
  switchBranch: vi.fn(),
  fetchSiblings: vi.fn(),
};

vi.mock('../../../runtime', () => ({
  useChatRuntime: () => mockRuntimeState,
}));

describe('MessageList branch filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRuntimeState.messages = [];
    mockRuntimeState.activeBranches = {};
    mockRuntimeState.siblingsCache = {};
  });

  it('should show only active branch after edit', () => {
    // Simulate state after editing a message:
    // - userMsg1 (original) with assistantMsg1
    // - userMsg2 (edited, active) with assistantMsg2
    const now = Date.now();
    mockRuntimeState.messages = [
      {
        id: 'user-1',
        conversationId: 'conv-1',
        parentId: null,
        role: 'user',
        content: 'Original message',
        status: 'complete',
        createdAt: new Date(now).toISOString(),
      },
      {
        id: 'assistant-1',
        conversationId: 'conv-1',
        parentId: 'user-1',
        role: 'assistant',
        content: 'Original response',
        status: 'complete',
        createdAt: new Date(now + 1000).toISOString(),
      },
      {
        id: 'user-2',
        conversationId: 'conv-1',
        parentId: null, // Same parent as user-1 (sibling)
        role: 'user',
        content: 'Edited message',
        status: 'complete',
        createdAt: new Date(now + 2000).toISOString(),
      },
      {
        id: 'assistant-2',
        conversationId: 'conv-1',
        parentId: 'user-2',
        role: 'assistant',
        content: 'New response',
        status: 'complete',
        createdAt: new Date(now + 3000).toISOString(),
      },
    ];

    // Active branch points to edited message
    mockRuntimeState.activeBranches = {
      '__ROOT__': 'user-2',
    };

    render(<MessageList />);

    // Should show edited message and its response
    expect(screen.getByText('Edited message')).toBeDefined();
    expect(screen.getByText('New response')).toBeDefined();

    // Should NOT show original message and its response
    expect(screen.queryByText('Original message')).toBeNull();
    expect(screen.queryByText('Original response')).toBeNull();
  });

  it('should show original branch when switched back', () => {
    const now = Date.now();
    mockRuntimeState.messages = [
      {
        id: 'user-1',
        conversationId: 'conv-1',
        parentId: null,
        role: 'user',
        content: 'Original message',
        status: 'complete',
        createdAt: new Date(now).toISOString(),
      },
      {
        id: 'assistant-1',
        conversationId: 'conv-1',
        parentId: 'user-1',
        role: 'assistant',
        content: 'Original response',
        status: 'complete',
        createdAt: new Date(now + 1000).toISOString(),
      },
      {
        id: 'user-2',
        conversationId: 'conv-1',
        parentId: null,
        role: 'user',
        content: 'Edited message',
        status: 'complete',
        createdAt: new Date(now + 2000).toISOString(),
      },
      {
        id: 'assistant-2',
        conversationId: 'conv-1',
        parentId: 'user-2',
        role: 'assistant',
        content: 'New response',
        status: 'complete',
        createdAt: new Date(now + 3000).toISOString(),
      },
    ];

    // Switch back to original
    mockRuntimeState.activeBranches = {
      '__ROOT__': 'user-1',
    };

    render(<MessageList />);

    // Should show original message and its response
    expect(screen.getByText('Original message')).toBeDefined();
    expect(screen.getByText('Original response')).toBeDefined();

    // Should NOT show edited message and its response
    expect(screen.queryByText('Edited message')).toBeNull();
    expect(screen.queryByText('New response')).toBeNull();
  });

  it('should default to last sibling when no active branch set', () => {
    const now = Date.now();
    mockRuntimeState.messages = [
      {
        id: 'user-1',
        conversationId: 'conv-1',
        parentId: null,
        role: 'user',
        content: 'First message',
        status: 'complete',
        createdAt: new Date(now).toISOString(),
      },
      {
        id: 'user-2',
        conversationId: 'conv-1',
        parentId: null,
        role: 'user',
        content: 'Second message',
        status: 'complete',
        createdAt: new Date(now + 1000).toISOString(),
      },
    ];

    // No active branch set
    mockRuntimeState.activeBranches = {};

    render(<MessageList />);

    // Should show last sibling (user-2)
    expect(screen.getByText('Second message')).toBeDefined();
    expect(screen.queryByText('First message')).toBeNull();
  });

  it('should handle deep branch chains', () => {
    const now = Date.now();
    mockRuntimeState.messages = [
      {
        id: 'user-1',
        conversationId: 'conv-1',
        parentId: null,
        role: 'user',
        content: 'User 1',
        status: 'complete',
        createdAt: new Date(now).toISOString(),
      },
      {
        id: 'assistant-1',
        conversationId: 'conv-1',
        parentId: 'user-1',
        role: 'assistant',
        content: 'Assistant 1',
        status: 'complete',
        createdAt: new Date(now + 1000).toISOString(),
      },
      {
        id: 'user-2',
        conversationId: 'conv-1',
        parentId: 'assistant-1',
        role: 'user',
        content: 'User 2',
        status: 'complete',
        createdAt: new Date(now + 2000).toISOString(),
      },
      {
        id: 'assistant-2',
        conversationId: 'conv-1',
        parentId: 'user-2',
        role: 'assistant',
        content: 'Assistant 2',
        status: 'complete',
        createdAt: new Date(now + 3000).toISOString(),
      },
    ];

    mockRuntimeState.activeBranches = {};

    render(<MessageList />);

    // All messages should be visible (linear chain, no branches)
    expect(screen.getByText('User 1')).toBeDefined();
    expect(screen.getByText('Assistant 1')).toBeDefined();
    expect(screen.getByText('User 2')).toBeDefined();
    expect(screen.getByText('Assistant 2')).toBeDefined();
  });

  it('should show branch navigator when siblings exist', () => {
    const now = Date.now();
    mockRuntimeState.messages = [
      {
        id: 'user-1',
        conversationId: 'conv-1',
        parentId: null,
        role: 'user',
        content: 'Message 1',
        status: 'complete',
        createdAt: new Date(now).toISOString(),
      },
      {
        id: 'user-2',
        conversationId: 'conv-1',
        parentId: null,
        role: 'user',
        content: 'Message 2',
        status: 'complete',
        createdAt: new Date(now + 1000).toISOString(),
      },
    ];

    mockRuntimeState.activeBranches = {
      '__ROOT__': 'user-2',
    };

    render(<MessageList />);

    // Should show navigation indicator (1/2 or 2/2)
    expect(screen.getByText(/[12]\/2/)).toBeDefined();
  });
});
