'use client';

import * as React from 'react';
import type { Message } from '@ai-life-os/contracts';
import { MessageBubble } from './message-bubble';
import { useChatRuntime } from '../../runtime';

interface MessageListProps {
  conversationId?: string;
}

export function MessageList({ conversationId }: MessageListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = React.useState(false);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = React.useState(true);

  const {
    messages,
    editMessage,
    switchBranch,
    fetchSiblings,
    activeBranches,
    siblingsCache
  } = useChatRuntime();

  const handleScroll = React.useCallback(() => {
    if (!scrollRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const scrolledFromBottom = scrollHeight - scrollTop - clientHeight;

    setShowScrollButton(scrolledFromBottom > 100);

    if (scrolledFromBottom > 50) {
      setIsAutoScrollEnabled(false);
    }
  }, []);

  const scrollToBottom = React.useCallback(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
    setIsAutoScrollEnabled(true);
  }, []);

  React.useEffect(() => {
    if (isAutoScrollEnabled && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isAutoScrollEnabled]);

  // Group messages by parentId to find siblings
  const messagesByParent = React.useMemo(() => {
    const grouped = new Map<string, Message[]>();
    for (const msg of messages) {
      const parentKey = msg.parentId || '__ROOT__';
      if (!grouped.has(parentKey)) {
        grouped.set(parentKey, []);
      }
      grouped.get(parentKey)!.push(msg);
    }
    return grouped;
  }, [messages]);

  // Get siblings for a message (messages with same parentId)
  const getSiblings = React.useCallback((message: Message): Message[] => {
    const parentKey = message.parentId || '__ROOT__';
    return messagesByParent.get(parentKey) || [message];
  }, [messagesByParent]);

  // Build visible path through the message tree following active branches
  const visibleMessages = React.useMemo(() => {
    const visible: Message[] = [];

    // Start from ROOT and traverse down through active branches
    const traverse = (parentKey: string) => {
      const children = messagesByParent.get(parentKey);
      if (!children || children.length === 0) return;

      // Sort children by createdAt
      const sorted = [...children].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // Find active child or default to last one
      const activeId = activeBranches[parentKey];
      let activeChild: Message;

      if (activeId) {
        const found = sorted.find(m => m.id === activeId);
        activeChild = found || sorted[sorted.length - 1];
      } else {
        activeChild = sorted[sorted.length - 1];
      }

      // Add this message to visible list
      visible.push(activeChild);

      // Continue traversal with this message's children
      traverse(activeChild.id);
    };

    // Start traversal from ROOT
    traverse('__ROOT__');

    return visible;
  }, [messagesByParent, activeBranches]);

  const handleNavigate = React.useCallback((messageId: string, targetMessageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    switchBranch(message.parentId, targetMessageId);
  }, [messages, switchBranch]);

  const handleEditClick = React.useCallback(async (messageId: string, newContent: string) => {
    console.log('[MessageList] handleEditClick called with messageId:', messageId);
    console.log('[MessageList] Current messages in component:', messages.map(m => ({ id: m.id, role: m.role })));
    await editMessage(messageId, newContent);
  }, [editMessage, messages]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-4 py-6"
      >
        {visibleMessages.map((message) => {
          const siblings = getSiblings(message);
          const showBranchNav = siblings.length > 1;

          return (
            <MessageBubble
              key={message.id}
              role={message.role}
              content={message.content}
              messageId={message.id}
              siblings={showBranchNav ? siblings : undefined}
              onEdit={handleEditClick}
              onNavigate={showBranchNav ? (targetId) => handleNavigate(message.id, targetId) : undefined}
            />
          );
        })}
      </div>

      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 rounded-full bg-gray-800 p-2 text-white shadow-lg hover:bg-gray-700"
          aria-label="Scroll to bottom"
        >
          ↓
        </button>
      )}
    </div>
  );
}
