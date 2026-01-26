'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { ChatPanel } from '@ai-life-os/ui';

export default function ChatPage() {
  const router = useRouter();

  const handleThreadCreated = useCallback(
    (id: string) => {
      router.push(`/chat/${id}`);
    },
    [router]
  );

  return <ChatPanel onThreadCreated={handleThreadCreated} />;
}
