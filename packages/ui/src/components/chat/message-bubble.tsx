import * as React from 'react';
import { MarkdownRenderer } from './markdown-renderer';
import { MessageActions } from './message-actions';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  messageId?: string;
  onEdit?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
}

export function MessageBubble({ role, content, messageId, onEdit, onRegenerate }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-zinc-700 text-white'
            : 'bg-gray-700 text-gray-100'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <MarkdownRenderer content={content} />
        )}
        <MessageActions
          role={role}
          content={content}
          messageId={messageId}
          onEdit={onEdit}
          onRegenerate={onRegenerate}
        />
      </div>
    </div>
  );
}
