import type { Message } from '@ai-life-os/contracts';

/**
 * Creates an optimistic user message (not yet confirmed by server).
 */
export function createOptimisticUserMessage(
  conversationId: string,
  content: string,
  parentId: string | null
): Message {
  return {
    id: crypto.randomUUID(),
    conversationId,
    parentId,
    role: 'user',
    content,
    status: 'complete',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Creates an optimistic assistant message (streaming state).
 */
export function createOptimisticAssistantMessage(
  conversationId: string,
  parentId: string
): Message {
  return {
    id: crypto.randomUUID(),
    conversationId,
    parentId,
    role: 'assistant',
    content: '',
    status: 'streaming',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Creates a user message with a known ID (from server metadata).
 */
export function createUserMessage(
  id: string,
  conversationId: string,
  content: string,
  parentId: string | null
): Message {
  return {
    id,
    conversationId,
    parentId,
    role: 'user',
    content,
    status: 'complete',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Creates an assistant message with a known ID (from server metadata).
 */
export function createAssistantMessage(
  id: string,
  conversationId: string,
  parentId: string
): Message {
  return {
    id,
    conversationId,
    parentId,
    role: 'assistant',
    content: '',
    status: 'streaming',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Creates a pair of optimistic messages for a new chat turn.
 */
export function createOptimisticMessagePair(
  conversationId: string,
  content: string,
  lastMessageId: string | undefined
): [Message, Message] {
  const userMsg = createOptimisticUserMessage(
    conversationId,
    content,
    lastMessageId ?? null
  );

  const assistantMsg = createOptimisticAssistantMessage(
    conversationId,
    userMsg.id
  );

  return [userMsg, assistantMsg];
}

/**
 * Updates a message in an array by ID.
 */
export function updateMessageById(
  messages: Message[],
  id: string,
  updates: Partial<Message>
): Message[] {
  return messages.map((m) =>
    m.id === id ? { ...m, ...updates } : m
  );
}

/**
 * Replaces temp IDs with real IDs from server metadata.
 */
export function replaceMessageIds(
  messages: Message[],
  tempUserId: string,
  tempAssistantId: string,
  realUserId: string,
  realAssistantId: string
): Message[] {
  return messages.map((m) => {
    if (m.id === tempUserId) {
      return { ...m, id: realUserId };
    }
    if (m.id === tempAssistantId) {
      return { ...m, id: realAssistantId, parentId: realUserId };
    }
    return m;
  });
}

/**
 * Marks a message as complete with final content.
 */
export function finalizeMessage(
  messages: Message[],
  id: string,
  content: string
): Message[] {
  return updateMessageById(messages, id, {
    content,
    status: 'complete',
  });
}
