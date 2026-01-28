'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Conversation } from '@ai-life-os/contracts';
import { validateTitle } from '@ai-life-os/contracts';
import { generateTitle } from '../../utils/title-generator';

interface ThreadItemProps {
  conversation: Conversation;
  isActive: boolean;
  onDelete: () => void;
  onTitleUpdate?: (newTitle: string) => void;
}

export function ThreadItem({ conversation, isActive, onDelete, onTitleUpdate }: ThreadItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const title = conversation.title || generateTitle('');

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setEditValue(title);
    setIsEditing(true);
  };

  const handleSave = async () => {
    const validation = validateTitle(editValue);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    try {
      const response = await fetch(`/api/threads/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editValue.trim() }),
      });

      if (!response.ok) throw new Error('Failed to update title');

      setIsEditing(false);
      onTitleUpdate?.(editValue.trim());
    } catch (error) {
      console.error('Failed to update title:', error);
      alert('Failed to update title');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`group flex items-center justify-between px-4 py-3 hover:bg-accent ${
        isActive ? 'bg-accent' : ''
      }`}
    >
      {isEditing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="flex-1 rounded border border-border bg-background px-2 py-1 text-foreground"
          autoFocus
        />
      ) : (
        <Link
          href={`/chat/${conversation.id}`}
          className="flex-1 truncate text-foreground"
          onDoubleClick={handleDoubleClick}
        >
          {title}
        </Link>
      )}
      <button
        onClick={(e) => {
          e.preventDefault();
          onDelete();
        }}
        className="ml-2 hidden rounded p-1 text-muted-foreground hover:bg-secondary hover:text-destructive group-hover:block"
        aria-label="Delete conversation"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
