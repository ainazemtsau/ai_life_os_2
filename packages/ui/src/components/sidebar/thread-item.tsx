'use client';

import Link from 'next/link';
import type { Conversation } from '@ai-life-os/contracts';
import { generateTitle } from '../../utils/title-generator';

interface ThreadItemProps {
  conversation: Conversation;
  isActive: boolean;
  onDelete: () => void;
}

export function ThreadItem({ conversation, isActive, onDelete }: ThreadItemProps) {
  const title = conversation.title || generateTitle('');

  return (
    <div
      className={`group flex items-center justify-between px-4 py-3 hover:bg-accent ${
        isActive ? 'bg-accent' : ''
      }`}
    >
      <Link
        href={`/chat/${conversation.id}`}
        className="flex-1 truncate text-foreground"
      >
        {title}
      </Link>
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
