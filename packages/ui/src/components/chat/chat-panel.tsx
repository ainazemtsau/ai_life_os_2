'use client';

import * as React from 'react';
import { useChatRuntime } from '../../runtime';
import { MessageList } from './message-list';
import { MessageInput } from './message-input';

interface ChatPanelProps {
  conversationId?: string;
  onConversationCreated?: (id: string) => void;
}

export function ChatPanel({ conversationId, onConversationCreated }: ChatPanelProps) {
  const { conversationId: activeConversationId, switchConversation, sendMessage, isGenerating, error } = useChatRuntime();
  const onConversationCreatedRef = React.useRef(onConversationCreated);
  onConversationCreatedRef.current = onConversationCreated;

  // Load conversation when conversationId changes
  React.useEffect(() => {
    if (conversationId && conversationId !== activeConversationId) {
      switchConversation(conversationId);
    }
  }, [conversationId, activeConversationId, switchConversation]);

  const handleSendMessage = React.useCallback(
    async (content: string) => {
      await sendMessage(content, onConversationCreatedRef.current);
    },
    [sendMessage]
  );

  return (
    <div className="flex h-full flex-col">
      <MessageList conversationId={conversationId} />
      <MessageInput onSend={handleSendMessage} disabled={isGenerating} />
      {error && (
        <div className="bg-red-900/50 p-2 text-center text-red-200">
          {error.message}
        </div>
      )}
    </div>
  );
}
