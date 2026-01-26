'use client';

import * as React from 'react';
import {
  AssistantRuntimeProvider,
  Thread,
  useExternalStoreRuntime,
  type ThreadMessageLike,
} from '@assistant-ui/react';
import { useChatRuntime, type ChatRuntimeState } from '../../runtime';

interface ChatPanelProps {
  conversationId?: string;
  onThreadCreated?: (id: string) => void;
}

// Convert our Message format to assistant-ui ThreadMessageLike
function convertMessage(msg: ChatRuntimeState['messages'][number]): ThreadMessageLike {
  return {
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    createdAt: new Date(msg.createdAt),
  };
}

export function ChatPanel({ conversationId, onThreadCreated }: ChatPanelProps) {
  console.log('[ChatPanel] render, conversationId:', conversationId);
  const chatRuntime = useChatRuntime();
  const onThreadCreatedRef = React.useRef(onThreadCreated);
  onThreadCreatedRef.current = onThreadCreated;

  // Load thread when conversationId changes
  React.useEffect(() => {
    if (conversationId && conversationId !== chatRuntime.threadId) {
      chatRuntime.switchThread(conversationId);
    }
  }, [conversationId, chatRuntime]);

  const onNew = React.useCallback(
    async (message: { content: Array<{ type: string; text?: string }> }) => {
      const textContent = message.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map((c) => c.text)
        .join('');

      if (textContent) {
        await chatRuntime.sendMessage(textContent, onThreadCreatedRef.current);
      }
    },
    [chatRuntime]
  );

  const onCancel = React.useCallback(async () => {
    chatRuntime.abort();
  }, [chatRuntime]);

  // Debug: log messages
  React.useEffect(() => {
    console.log('[ChatPanel] messages:', chatRuntime.messages.length, chatRuntime.messages);
  }, [chatRuntime.messages]);

  // Create external store adapter for assistant-ui
  const runtime = useExternalStoreRuntime({
    messages: chatRuntime.messages,
    isRunning: chatRuntime.isGenerating,
    convertMessage,
    onNew,
    onCancel,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-full flex-col">
        <Thread />
        {chatRuntime.error && (
          <div className="bg-red-900/50 p-2 text-center text-red-200">
            {chatRuntime.error}
          </div>
        )}
      </div>
    </AssistantRuntimeProvider>
  );
}
