'use client';

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import type { Message, Conversation } from '@ai-life-os/contracts';

// Single-user mode - hardcoded for simplicity
const PHASE1_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_ASSISTANT_ID = '00000000-0000-0000-0000-000000000001';

export interface ChatRuntimeState {
  threadId: string | null;
  messages: Message[];
  isGenerating: boolean;
  error: string | null;
}

export interface ChatRuntimeActions {
  sendMessage: (content: string, onThreadCreated?: (id: string) => void) => Promise<void>;
  switchThread: (threadId: string) => Promise<void>;
  createThread: (assistantId: string) => Promise<Conversation>;
  abort: () => void;
}

type Subscriber = () => void;

function createChatStore() {
  let state: ChatRuntimeState = {
    threadId: null,
    messages: [],
    isGenerating: false,
    error: null,
  };
  const subscribers = new Set<Subscriber>();
  let abortController: AbortController | null = null;

  const notify = () => subscribers.forEach((fn) => fn());

  const setState = (
    partial: Partial<ChatRuntimeState> | ((prev: ChatRuntimeState) => Partial<ChatRuntimeState>)
  ) => {
    const updates = typeof partial === 'function' ? partial(state) : partial;
    state = { ...state, ...updates };
    notify();
  };

  return {
    getState: () => state,
    subscribe: (fn: Subscriber) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },

    async sendMessage(content: string, onThreadCreated?: (id: string) => void) {
      let threadId = state.threadId;

      // Auto-create thread if none exists
      if (!threadId) {
        const response = await fetch('/api/threads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: PHASE1_USER_ID, assistantId: DEFAULT_ASSISTANT_ID }),
        });
        if (!response.ok) throw new Error('Failed to create thread');
        const { conversation } = await response.json();
        threadId = conversation.id;
        setState({ threadId });
        onThreadCreated?.(threadId);
      }

      abortController = new AbortController();
      setState({ isGenerating: true, error: null });

      // Optimistic update: add user message immediately
      const tempUserMsg: Message = {
        id: crypto.randomUUID(),
        conversationId: threadId,
        parentId: state.messages[state.messages.length - 1]?.id ?? null,
        role: 'user',
        content,
        status: 'complete',
        createdAt: new Date().toISOString(),
      };

      const tempAssistantMsg: Message = {
        id: crypto.randomUUID(),
        conversationId: threadId,
        parentId: tempUserMsg.id,
        role: 'assistant',
        content: '',
        status: 'streaming',
        createdAt: new Date().toISOString(),
      };

      setState({
        messages: [...state.messages, tempUserMsg, tempAssistantMsg],
      });

      try {
        const response = await fetch(`/api/chat/${threadId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        // ReadableStream allows chunk-by-chunk UI updates without buffering full response
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          fullContent += decoder.decode(value, { stream: true });

          // Use functional setState to prevent stale closures - rapid streaming chunks must read current state, not closure-captured state from start of stream
          setState((prevState) => ({
            messages: prevState.messages.map((m) =>
              m.id === tempAssistantMsg.id ? { ...m, content: fullContent } : m
            ),
          }));
        }

        setState((prevState) => ({
          isGenerating: false,
          messages: prevState.messages.map((m) =>
            m.id === tempAssistantMsg.id
              ? { ...m, content: fullContent, status: 'complete' }
              : m
          ),
        }));
      } catch (error) {
        const isAborted = (error as Error).name === 'AbortError';
        setState((prevState) => ({
          isGenerating: false,
          error: isAborted ? null : String(error),
          messages: prevState.messages.map((m) =>
            m.id === tempAssistantMsg.id
              ? { ...m, status: isAborted ? 'stopped' : 'error' }
              : m
          ),
        }));
      }
    },

    async switchThread(threadId: string) {
      setState({ threadId, messages: [], isGenerating: false, error: null });

      try {
        const response = await fetch(`/api/threads/${threadId}/messages`);
        if (!response.ok) throw new Error('Failed to load messages');

        const { messages } = await response.json();
        setState({ messages });
      } catch (error) {
        setState({ error: String(error) });
      }
    },

    async createThread(assistantId: string): Promise<Conversation> {
      const response = await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: PHASE1_USER_ID, assistantId }),
      });

      if (!response.ok) throw new Error('Failed to create thread');

      const { conversation } = await response.json();
      setState({ threadId: conversation.id, messages: [] });
      return conversation;
    },

    abort() {
      abortController?.abort();
      abortController = null;
    },
  };
}

let storeInstance: ReturnType<typeof createChatStore> | null = null;

function getStore() {
  if (!storeInstance) {
    storeInstance = createChatStore();
  }
  return storeInstance;
}

export function useChatRuntime(): ChatRuntimeState & ChatRuntimeActions {
  const store = useMemo(() => getStore(), []);

  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState
  );

  const sendMessage = useCallback(
    (content: string, onThreadCreated?: (id: string) => void) =>
      store.sendMessage(content, onThreadCreated),
    [store]
  );
  const switchThread = useCallback(
    (id: string) => store.switchThread(id),
    [store]
  );
  const createThread = useCallback(
    (assistantId: string) => store.createThread(assistantId),
    [store]
  );
  const abort = useCallback(() => store.abort(), [store]);

  return {
    ...state,
    sendMessage,
    switchThread,
    createThread,
    abort,
  };
}
