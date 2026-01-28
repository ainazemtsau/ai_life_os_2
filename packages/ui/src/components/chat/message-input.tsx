'use client';

import * as React from 'react';
import { Button } from '../../button';

interface MessageInputProps {
  onSend: (content: string) => void | Promise<void>;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [input, setInput] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || disabled) return;

      const content = input;
      setInput('');
      await onSend(content);
    },
    [input, disabled, onSend]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  return (
    <div className="border-t border-gray-700 bg-gray-900 p-4">
      <form onSubmit={handleSubmit}>
        <div className="mx-auto flex max-w-4xl items-end gap-2">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={disabled}
              className="min-h-[60px] w-full resize-none rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 text-white placeholder-gray-400 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          <Button
            type="submit"
            disabled={disabled || !input.trim()}
            className="rounded-lg bg-zinc-700 px-4 py-3 text-white hover:bg-zinc-600 disabled:opacity-50"
          >
            Send
          </Button>
        </div>

        {disabled && (
          <div className="mx-auto mt-2 max-w-4xl text-sm text-gray-400">
            <span className="inline-flex items-center gap-2">
              <span className="animate-pulse">●</span>
              AI is responding...
            </span>
          </div>
        )}
      </form>
    </div>
  );
}
