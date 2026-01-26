'use client';

import { useEffect } from 'react';

export interface KeyboardShortcutHandlers {
  onEscape?: () => void;
  onNewConversation?: () => void;
  onFocusInput?: () => void;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handlers.onEscape?.();
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'O') {
        event.preventDefault();
        handlers.onNewConversation?.();
      }

      if ((event.ctrlKey || event.metaKey) && event.key === '/') {
        event.preventDefault();
        handlers.onFocusInput?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
