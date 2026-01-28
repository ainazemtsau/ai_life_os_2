'use client';

import * as React from 'react';
import type { Message } from '@ai-life-os/contracts';
import { MarkdownRenderer } from './markdown-renderer';
import { MessageActions } from './message-actions';
import { BranchNavigator } from './branch-navigator';
import { MessageEditForm } from './message-edit-form';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  messageId?: string;
  siblings?: Message[];
  onEdit?: (messageId: string, newContent: string) => void;
  onNavigate?: (targetMessageId: string) => void;
}

export function MessageBubble({ role, content, messageId, siblings, onEdit, onNavigate }: MessageBubbleProps) {
  const isUser = role === 'user';
  const [isEditing, setIsEditing] = React.useState(false);

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleSave = (newContent: string) => {
    setIsEditing(false);
    if (messageId && onEdit) {
      onEdit(messageId, newContent);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`group max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-zinc-700 text-white'
            : 'bg-gray-700 text-gray-100'
        }`}
      >
        {isEditing ? (
          <MessageEditForm
            initialContent={content}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        ) : (
          <>
            {isUser ? (
              <p className="whitespace-pre-wrap">{content}</p>
            ) : (
              <MarkdownRenderer content={content} />
            )}
            <MessageActions
              role={role}
              content={content}
              messageId={messageId}
              onEdit={handleEditClick}
            />
            {siblings && messageId && onNavigate && (
              <BranchNavigator
                siblings={siblings}
                currentMessageId={messageId}
                onNavigate={onNavigate}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
