import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatPanel } from '../chat-panel';

global.fetch = vi.fn();

vi.mock('../../../runtime', () => ({
  useChatRuntime: () => ({
    conversationId: 'conv-1',
    messages: [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        parentId: null,
        role: 'user',
        content: 'Hello',
        status: 'complete',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'msg-2',
        conversationId: 'conv-1',
        parentId: 'msg-1',
        role: 'assistant',
        content: 'Hi there!',
        status: 'complete',
        createdAt: new Date().toISOString(),
      },
    ],
    isGenerating: false,
    error: null,
    activeBranches: {},
    siblingsCache: {},
    sendMessage: vi.fn(),
    editMessage: vi.fn(),
    switchConversation: vi.fn(),
    switchBranch: vi.fn(),
    fetchSiblings: vi.fn(),
    createConversation: vi.fn(),
    abort: vi.fn(),
  }),
}));

describe('ChatPanel integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render messages from runtime', () => {
    render(<ChatPanel conversationId="conv-1" />);

    expect(screen.getByText('Hello')).toBeDefined();
    expect(screen.getByText('Hi there!')).toBeDefined();
  });

  it('should show error state when error present', () => {
    const { useChatRuntime } = require('../../../runtime');
    useChatRuntime.mockReturnValueOnce({
      conversationId: 'conv-1',
      messages: [],
      isGenerating: false,
      error: { message: 'Network error', code: 'NETWORK_ERROR' },
      activeBranches: {},
      siblingsCache: {},
      sendMessage: vi.fn(),
      editMessage: vi.fn(),
      switchConversation: vi.fn(),
      switchBranch: vi.fn(),
      fetchSiblings: vi.fn(),
      createConversation: vi.fn(),
      abort: vi.fn(),
    });

    render(<ChatPanel conversationId="conv-1" />);

    expect(screen.getByText('Network error')).toBeDefined();
  });

  it('should disable input during streaming', () => {
    const { useChatRuntime } = require('../../../runtime');
    useChatRuntime.mockReturnValueOnce({
      conversationId: 'conv-1',
      messages: [],
      isGenerating: true,
      error: null,
      activeBranches: {},
      siblingsCache: {},
      sendMessage: vi.fn(),
      editMessage: vi.fn(),
      switchConversation: vi.fn(),
      switchBranch: vi.fn(),
      fetchSiblings: vi.fn(),
      createConversation: vi.fn(),
      abort: vi.fn(),
    });

    render(<ChatPanel conversationId="conv-1" />);

    const input = screen.getByRole('textbox');
    expect(input.hasAttribute('disabled')).toBe(true);
  });
});
