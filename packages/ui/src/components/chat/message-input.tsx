'use client';

import * as React from 'react';
import { Composer } from '@assistant-ui/react';
import { Button } from '../../button';

interface MessageInputProps {
  conversationId?: string;
}

export function MessageInput({ conversationId }: MessageInputProps) {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const handleStop = React.useCallback(() => {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
  }, []);

  return (
    <div className="border-t border-gray-700 bg-gray-900 p-4">
      <Composer>
        <div className="mx-auto flex max-w-4xl items-end gap-2">
          <div className="flex-1">
            <Composer.Input
              placeholder="Type a message..."
              className="min-h-[60px] w-full resize-none rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 text-white placeholder-gray-400 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          {isGenerating ? (
            <Button
              type="button"
              onClick={handleStop}
              className="rounded-lg bg-red-600 px-4 py-3 text-white hover:bg-red-700"
            >
              Stop
            </Button>
          ) : (
            <Composer.Send className="rounded-lg bg-zinc-700 px-4 py-3 text-white hover:bg-zinc-600 disabled:opacity-50">
              Send
            </Composer.Send>
          )}
        </div>

        {isGenerating && (
          <div className="mx-auto mt-2 max-w-4xl text-sm text-gray-400">
            <span className="inline-flex items-center gap-2">
              <span className="animate-pulse">●</span>
              AI is responding...
            </span>
          </div>
        )}
      </Composer>
    </div>
  );
}
