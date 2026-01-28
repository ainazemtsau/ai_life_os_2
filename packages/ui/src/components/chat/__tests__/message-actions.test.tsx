import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageActions } from '../message-actions';

describe('MessageActions', () => {
  it('should show Edit button for user role', () => {
    const onEdit = vi.fn();
    render(
      <MessageActions
        role="user"
        content="test content"
        messageId="msg-1"
        onEdit={onEdit}
      />
    );

    const editButton = screen.getByTitle('Edit message');
    expect(editButton).toBeDefined();
  });

  it('should not show Edit button for assistant role', () => {
    const onEdit = vi.fn();
    render(
      <MessageActions
        role="assistant"
        content="test content"
        messageId="msg-1"
        onEdit={onEdit}
      />
    );

    const editButton = screen.queryByTitle('Edit message');
    expect(editButton).toBeNull();
  });

  it('should call onEdit when Edit button clicked', () => {
    const onEdit = vi.fn();
    render(
      <MessageActions
        role="user"
        content="test content"
        messageId="msg-1"
        onEdit={onEdit}
      />
    );

    const editButton = screen.getByTitle('Edit message');
    fireEvent.click(editButton);

    expect(onEdit).toHaveBeenCalled();
  });

  it('should show Copy button for all roles', () => {
    render(
      <MessageActions role="user" content="test content" messageId="msg-1" />
    );

    const copyButton = screen.getByTitle('Copy message');
    expect(copyButton).toBeDefined();
  });

  it('should show Copied after clicking Copy', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(
      <MessageActions role="user" content="test content" messageId="msg-1" />
    );

    const copyButton = screen.getByTitle('Copy message');
    fireEvent.click(copyButton);

    await vi.waitFor(() => {
      const copiedButton = screen.getByTitle('Copied!');
      expect(copiedButton).toBeDefined();
    });
  });
});
