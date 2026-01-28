import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BranchNavigator } from '../branch-navigator';
import type { Message } from '@ai-life-os/contracts';

const createMockMessage = (id: string, parentId: string): Message => ({
  id,
  conversationId: 'conv-1',
  parentId,
  role: 'assistant',
  content: `Message ${id}`,
  status: 'complete',
  createdAt: new Date().toISOString(),
});

describe('BranchNavigator', () => {
  it('should show "2/3" for second of three siblings', () => {
    const siblings = [
      createMockMessage('msg-1', 'parent-1'),
      createMockMessage('msg-2', 'parent-1'),
      createMockMessage('msg-3', 'parent-1'),
    ];

    render(
      <BranchNavigator
        siblings={siblings}
        currentMessageId="msg-2"
        onNavigate={vi.fn()}
      />
    );

    const counter = screen.getByText('2/3');
    expect(counter).toBeDefined();
  });

  it('should call onNavigate with previous sibling id when left arrow clicked', () => {
    const siblings = [
      createMockMessage('msg-1', 'parent-1'),
      createMockMessage('msg-2', 'parent-1'),
      createMockMessage('msg-3', 'parent-1'),
    ];
    const onNavigate = vi.fn();

    render(
      <BranchNavigator
        siblings={siblings}
        currentMessageId="msg-2"
        onNavigate={onNavigate}
      />
    );

    const leftArrow = screen.getByText('←');
    fireEvent.click(leftArrow);

    expect(onNavigate).toHaveBeenCalledWith('msg-1');
  });

  it('should call onNavigate with next sibling id when right arrow clicked', () => {
    const siblings = [
      createMockMessage('msg-1', 'parent-1'),
      createMockMessage('msg-2', 'parent-1'),
      createMockMessage('msg-3', 'parent-1'),
    ];
    const onNavigate = vi.fn();

    render(
      <BranchNavigator
        siblings={siblings}
        currentMessageId="msg-2"
        onNavigate={onNavigate}
      />
    );

    const rightArrow = screen.getByText('→');
    fireEvent.click(rightArrow);

    expect(onNavigate).toHaveBeenCalledWith('msg-3');
  });

  it('should disable left arrow at first sibling', () => {
    const siblings = [
      createMockMessage('msg-1', 'parent-1'),
      createMockMessage('msg-2', 'parent-1'),
      createMockMessage('msg-3', 'parent-1'),
    ];

    render(
      <BranchNavigator
        siblings={siblings}
        currentMessageId="msg-1"
        onNavigate={vi.fn()}
      />
    );

    const leftArrow = screen.getByText('←');
    expect(leftArrow.hasAttribute('disabled')).toBe(true);
  });

  it('should disable right arrow at last sibling', () => {
    const siblings = [
      createMockMessage('msg-1', 'parent-1'),
      createMockMessage('msg-2', 'parent-1'),
      createMockMessage('msg-3', 'parent-1'),
    ];

    render(
      <BranchNavigator
        siblings={siblings}
        currentMessageId="msg-3"
        onNavigate={vi.fn()}
      />
    );

    const rightArrow = screen.getByText('→');
    expect(rightArrow.hasAttribute('disabled')).toBe(true);
  });

  it('should be hidden when only one sibling', () => {
    const siblings = [createMockMessage('msg-1', 'parent-1')];

    const { container } = render(
      <BranchNavigator
        siblings={siblings}
        currentMessageId="msg-1"
        onNavigate={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should show total count when currentMessageId not found', () => {
    const siblings = [
      createMockMessage('msg-1', 'parent-1'),
      createMockMessage('msg-2', 'parent-1'),
      createMockMessage('msg-3', 'parent-1'),
    ];

    render(
      <BranchNavigator
        siblings={siblings}
        currentMessageId="msg-deleted"
        onNavigate={vi.fn()}
      />
    );

    const counter = screen.getByText('3/3');
    expect(counter).toBeDefined();
  });
});
