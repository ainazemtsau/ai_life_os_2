'use client';

import * as React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { ThreadItem } from './thread-item';
import { useChatRuntime } from '../../runtime';
import type { Conversation } from '@ai-life-os/contracts';

// Single-user mode - user ID hardcoded for simplicity
const PHASE1_USER_ID = '00000000-0000-0000-0000-000000000001';
// Default assistant ID (seeded in migration)
const DEFAULT_ASSISTANT_ID = '00000000-0000-0000-0000-000000000001';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ThreadListProps {
  defaultAssistantId?: string;
}

export function ThreadList({ defaultAssistantId }: ThreadListProps) {
  const router = useRouter();
  const params = useParams();
  const currentThreadId = params?.conversationId as string | undefined;
  const runtime = useChatRuntime();

  const { data, mutate } = useSWR<{ conversations: Conversation[] }>(
    `/api/threads?userId=${PHASE1_USER_ID}`,
    fetcher
  );

  const handleNewChat = React.useCallback(async () => {
    try {
      const assistantId = defaultAssistantId || DEFAULT_ASSISTANT_ID;
      const conversation = await runtime.createThread(assistantId);
      mutate();
      router.push(`/chat/${conversation.id}`);
    } catch (error) {
      console.error('Failed to create thread:', error);
    }
  }, [runtime, router, mutate, defaultAssistantId]);

  const handleDelete = React.useCallback(
    async (id: string) => {
      if (!confirm('Delete this conversation?')) return;

      try {
        await fetch(`/api/threads/${id}`, { method: 'DELETE' });
        mutate();
        if (currentThreadId === id) {
          router.push('/chat');
        }
      } catch (error) {
        console.error('Failed to delete thread:', error);
      }
    },
    [mutate, router, currentThreadId]
  );

  const conversations = data?.conversations ?? [];

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="space-y-2 p-4">
        <button
          onClick={handleNewChat}
          className="w-full rounded-lg bg-secondary px-4 py-2 text-secondary-foreground hover:bg-accent"
        >
          New Chat
        </button>
        <Link
          href="/assistants"
          className="block w-full rounded-lg border border-border px-4 py-2 text-center text-muted-foreground hover:bg-accent"
        >
          Manage Assistants
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conv) => (
          <ThreadItem
            key={conv.id}
            conversation={conv}
            isActive={conv.id === currentThreadId}
            onDelete={() => handleDelete(conv.id)}
          />
        ))}
        {conversations.length === 0 && (
          <div className="p-4 text-center text-muted-foreground">
            No conversations yet. Start a new chat!
          </div>
        )}
      </div>
    </div>
  );
}
