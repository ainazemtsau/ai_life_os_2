'use client';

import * as React from 'react';
import { Thread } from '@assistant-ui/react';
import { MessageBubble } from './message-bubble';

interface MessageListProps {
  conversationId?: string;
}

export function MessageList({ conversationId }: MessageListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = React.useState(false);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = React.useState(true);

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
  }, [isAutoScrollEnabled]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-4 py-6"
      >
        <Thread>
          <Thread.Messages
            components={{
              UserMessage: () => (
                <MessageBubble role="user" content="" />
              ),
              AssistantMessage: () => (
                <MessageBubble role="assistant" content="" />
              ),
            }}
          />
        </Thread>
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
