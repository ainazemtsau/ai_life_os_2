'use client';

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import type { Message, Conversation, SSEEvent } from '@ai-life-os/contracts';
import { ErrorResponseSchema, SiblingsResponseSchema, SSEEventSchema } from '@ai-life-os/contracts';
import { generateTitle } from '../utils/title-generator';

// Single-user mode - hardcoded for simplicity
const PHASE1_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_ASSISTANT_ID = '00000000-0000-0000-0000-000000000001';

export interface RuntimeError {
  message: string;
  code: string;
  details?: object;
}

export interface ChatRuntimeState {
  conversationId: string | null;
  messages: Message[];
  isGenerating: boolean;
  error: RuntimeError | null;
  // In-memory tracking (not persisted): simplifies implementation, clears on thread switch.
  // Tradeoff: lost on page refresh, but acceptable for single-session UX.
  activeBranches: Record<string, string>;
  siblingsCache: Record<string, Message[]>;
}

export interface ChatRuntimeActions {
  sendMessage: (content: string, onConversationCreated?: (id: string) => void) => Promise<void>;
  switchConversation: (conversationId: string) => Promise<void>;
  createConversation: (assistantId: string) => Promise<Conversation>;
  abort: () => void;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  switchBranch: (parentId: string | null, targetMessageId: string) => void;
  fetchSiblings: (messageId: string) => Promise<void>;
}

type Subscriber = () => void;

function createChatStore() {
  let state: ChatRuntimeState = {
    conversationId: null,
    messages: [],
    isGenerating: false,
    error: null,
    activeBranches: {},
    siblingsCache: {},
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

  async function ensureConversation(onConversationCreated?: (id: string) => void): Promise<string> {
    if (state.conversationId) return state.conversationId;

    const response = await fetch('/api/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: PHASE1_USER_ID, assistantId: DEFAULT_ASSISTANT_ID }),
    });
    if (!response.ok) throw new Error('Failed to create conversation');
    const { conversation } = await response.json();
    setState({ conversationId: conversation.id });
    onConversationCreated?.(conversation.id);
    return conversation.id;
  }

  async function setQuickTitleIfFirst(
    conversationId: string,
    content: string,
    isFirstMessage: boolean
  ): Promise<void> {
    if (!isFirstMessage) return;

    const quickTitle = generateTitle(content);
    await fetch(`/api/threads/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: quickTitle }),
    }).catch((err) => console.error('Failed to set quick title:', err));
  }

  function buildOptimisticMessages(
    content: string,
    conversationId: string,
    lastMessageId?: string
  ): [Message, Message] {
    const tempUserMsg: Message = {
      id: crypto.randomUUID(),
      conversationId,
      parentId: lastMessageId ?? null,
      role: 'user',
      content,
      status: 'complete',
      createdAt: new Date().toISOString(),
    };

    const tempAssistantMsg: Message = {
      id: crypto.randomUUID(),
      conversationId,
      parentId: tempUserMsg.id,
      role: 'assistant',
      content: '',
      status: 'streaming',
      createdAt: new Date().toISOString(),
    };

    return [tempUserMsg, tempAssistantMsg];
  }

  interface StreamResult {
    content: string;
    realUserMessageId: string | null;
    realAssistantMessageId: string | null;
  }

  async function streamResponse(
    conversationId: string,
    content: string,
    tempUserMsg: Message,
    tempAssistantMsg: Message,
    signal: AbortSignal
  ): Promise<StreamResult> {
    const response = await fetch(`/api/chat/${conversationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';
    let realUserMessageId: string | null = null;
    let realAssistantMessageId: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            const validated = SSEEventSchema.safeParse(parsed);

            if (!validated.success) {
              continue;
            }

            const event: SSEEvent = validated.data;

            if (event.type === 'meta') {
              realUserMessageId = event.userMessageId;
              realAssistantMessageId = event.assistantMessageId;

              // Replace temp IDs with real IDs from server
              setState((prevState) => ({
                messages: prevState.messages.map((m) => {
                  if (m.id === tempUserMsg.id) {
                    return { ...m, id: realUserMessageId! };
                  }
                  if (m.id === tempAssistantMsg.id) {
                    return {
                      ...m,
                      id: realAssistantMessageId!,
                      parentId: realUserMessageId,
                    };
                  }
                  return m;
                }),
              }));
            } else if (event.type === 'chunk') {
              fullContent += event.content;
              const msgIdToUpdate = realAssistantMessageId || tempAssistantMsg.id;
              setState((prevState) => ({
                messages: prevState.messages.map((m) =>
                  m.id === msgIdToUpdate ? { ...m, content: fullContent } : m
                ),
              }));
            } else if (event.type === 'complete') {
              fullContent = event.content;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    return { content: fullContent, realUserMessageId, realAssistantMessageId };
  }

  function triggerTitleEnhancement(
    conversationId: string,
    userContent: string,
    assistantContent: string,
    isFirstMessage: boolean
  ): void {
    if (!isFirstMessage) return;

    fetch('/api/utilities/title-generator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        messages: [
          { role: 'user', content: userContent },
          { role: 'assistant', content: assistantContent },
        ],
      }),
    }).catch((err) =>
      console.error(`Title enhancement failed for ${conversationId}:`, err)
    );
  }

  function buildOptimisticAssistantMessage(conversationId: string, parentId: string): Message {
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

  async function processStreamResponse(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    tempMessageId: string,
    setState: (partial: Partial<ChatRuntimeState> | ((prev: ChatRuntimeState) => Partial<ChatRuntimeState>)) => void
  ): Promise<{ content: string; hadErrors: boolean }> {
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';
    let hadErrors = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        // Expects SSE format from /api/messages/[id]/edit endpoint
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullContent = parsed.content;
              setState((prevState) => ({
                messages: prevState.messages.map((m) =>
                  m.id === tempMessageId ? { ...m, content: fullContent } : m
                ),
              }));
            }
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
            hadErrors = true;
          }
        }
      }
    }

    return { content: fullContent, hadErrors };
  }

  function finalizeStreamedMessage(
    tempMessageId: string,
    fullContent: string,
    parentId: string,
    setState: (partial: Partial<ChatRuntimeState> | ((prev: ChatRuntimeState) => Partial<ChatRuntimeState>)) => void
  ): void {
    setState((prevState) => {
      const parentKey = parentId || '__ROOT__';
      return {
        isGenerating: false,
        messages: prevState.messages.map((m) =>
          m.id === tempMessageId
            ? { ...m, content: fullContent, status: 'complete' }
            : m
        ),
        activeBranches: {
          ...prevState.activeBranches,
          [parentKey]: tempMessageId,
        },
      };
    });
  }

  function handleStreamError(
    error: unknown,
    tempMessageId: string,
    setState: (partial: Partial<ChatRuntimeState> | ((prev: ChatRuntimeState) => Partial<ChatRuntimeState>)) => void
  ): void {
    const isAborted = (error as Error).name === 'AbortError';
    setState((prevState) => ({
      isGenerating: false,
      error: isAborted ? null : {
        message: String(error),
        code: 'STREAM_ERROR',
      },
      messages: prevState.messages.map((m) =>
        m.id === tempMessageId
          ? { ...m, status: isAborted ? 'stopped' : 'error' }
          : m
      ),
    }));
  }

  return {
    getState: () => state,
    subscribe: (fn: Subscriber) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },

    async sendMessage(content: string, onConversationCreated?: (id: string) => void) {
      const isFirstMessage = state.messages.length === 0;
      const conversationId = await ensureConversation(onConversationCreated);

      await setQuickTitleIfFirst(conversationId, content, isFirstMessage);

      abortController = new AbortController();
      setState({ isGenerating: true, error: null });

      const lastMessageId = state.messages[state.messages.length - 1]?.id;
      const [tempUserMsg, tempAssistantMsg] = buildOptimisticMessages(
        content,
        conversationId,
        lastMessageId
      );

      setState({
        messages: [...state.messages, tempUserMsg, tempAssistantMsg],
      });

      try {
        const result = await streamResponse(
          conversationId,
          content,
          tempUserMsg,
          tempAssistantMsg,
          abortController.signal
        );

        // Use real ID if available, otherwise fall back to temp ID
        const assistantMsgId = result.realAssistantMessageId || tempAssistantMsg.id;

        setState((prevState) => ({
          isGenerating: false,
          messages: prevState.messages.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: result.content, status: 'complete' }
              : m
          ),
        }));

        triggerTitleEnhancement(conversationId, content, result.content, isFirstMessage);
      } catch (error) {
        const isAborted = (error as Error).name === 'AbortError';
        // Need to check both temp and real IDs since they may have been swapped
        setState((prevState) => ({
          isGenerating: false,
          error: isAborted ? null : {
            message: String(error),
            code: 'SEND_MESSAGE_ERROR',
          },
          messages: prevState.messages.map((m) =>
            m.role === 'assistant' && m.status === 'streaming'
              ? { ...m, status: isAborted ? 'stopped' : 'error' }
              : m
          ),
        }));
      }
    },

    async switchConversation(conversationId: string) {
      setState({
        conversationId,
        messages: [],
        isGenerating: false,
        error: null,
        activeBranches: {},
        siblingsCache: {},
      });

      try {
        const response = await fetch(`/api/threads/${conversationId}/messages`);
        if (!response.ok) throw new Error('Failed to load messages');

        const { messages } = await response.json();
        setState({ messages });
      } catch (error) {
        setState({
          error: {
            message: String(error),
            code: 'SWITCH_CONVERSATION_ERROR',
          }
        });
      }
    },

    async createConversation(assistantId: string): Promise<Conversation> {
      const response = await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: PHASE1_USER_ID, assistantId }),
      });

      if (!response.ok) throw new Error('Failed to create conversation');

      const { conversation } = await response.json();
      setState({ conversationId: conversation.id, messages: [] });
      return conversation;
    },

    abort() {
      abortController?.abort();
      abortController = null;
    },

    async editMessage(messageId: string, newContent: string) {
      if (!state.conversationId) {
        setState({
          error: {
            message: 'No active conversation',
            code: 'NO_CONVERSATION',
          }
        });
        return;
      }

      // Find original message to get its parentId for branch navigation
      const originalMessage = state.messages.find(m => m.id === messageId);

      if (!originalMessage) {
        setState({
          error: {
            message: 'Message not found',
            code: 'MESSAGE_NOT_FOUND',
          }
        });
        return;
      }

      const conversationId = state.conversationId;
      abortController = new AbortController();
      setState({ isGenerating: true, error: null });

      let userMessageId: string | null = null;
      let assistantMessageId: string | null = null;
      let fullContent = '';

      try {
        const response = await fetch(`/api/messages/${messageId}/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newContent }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          const parsedError = ErrorResponseSchema.safeParse(errorData);
          throw new Error(
            parsedError.success
              ? parsedError.data.error
              : `API error: ${response.status}`
          );
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                const parsed = JSON.parse(data);
                const validated = SSEEventSchema.safeParse(parsed);

                if (!validated.success) {
                  console.error('Invalid SSE event:', parsed);
                  continue;
                }

                const event: SSEEvent = validated.data;

                if (event.type === 'meta') {
                  userMessageId = event.userMessageId;
                  assistantMessageId = event.assistantMessageId;

                  // Create optimistic messages with REAL IDs from server
                  const newUserMsg: Message = {
                    id: userMessageId,
                    conversationId,
                    parentId: originalMessage.parentId,
                    role: 'user',
                    content: newContent,
                    status: 'complete',
                    createdAt: new Date().toISOString(),
                  };

                  const newAssistantMsg: Message = {
                    id: assistantMessageId,
                    conversationId,
                    parentId: userMessageId,
                    role: 'assistant',
                    content: '',
                    status: 'streaming',
                    createdAt: new Date().toISOString(),
                  };

                  setState(prev => ({
                    messages: [...prev.messages, newUserMsg, newAssistantMsg],
                  }));
                } else if (event.type === 'chunk' && assistantMessageId) {
                  fullContent += event.content;
                  setState(prev => ({
                    messages: prev.messages.map(m =>
                      m.id === assistantMessageId ? { ...m, content: fullContent } : m
                    ),
                  }));
                } else if (event.type === 'complete') {
                  fullContent = event.content;
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }

        // Finalize state after stream completes
        const parentKey = originalMessage.parentId || '__ROOT__';
        setState(prev => ({
          isGenerating: false,
          messages: prev.messages.map(m =>
            m.id === assistantMessageId
              ? { ...m, content: fullContent, status: 'complete' }
              : m
          ),
          // Switch active branch to the new user message
          activeBranches: userMessageId
            ? { ...prev.activeBranches, [parentKey]: userMessageId }
            : prev.activeBranches,
          // Clear siblings cache to force refetch
          siblingsCache: {},
        }));
      } catch (error) {
        const isAborted = (error as Error).name === 'AbortError';
        setState(prev => ({
          isGenerating: false,
          error: isAborted ? null : {
            message: String(error),
            code: 'EDIT_ERROR'
          },
          // If we created messages but failed, mark assistant as error
          messages: assistantMessageId
            ? prev.messages.map(m =>
                m.id === assistantMessageId
                  ? { ...m, status: isAborted ? 'stopped' : 'error' }
                  : m
              )
            : prev.messages,
        }));
      }
    },

    switchBranch(parentId: string | null, targetMessageId: string) {
      const parentKey = parentId || '__ROOT__';
      setState((prevState) => ({
        activeBranches: {
          ...prevState.activeBranches,
          [parentKey]: targetMessageId,
        },
      }));
    },

    async fetchSiblings(messageId: string) {
      try {
        const response = await fetch(`/api/messages/${messageId}/siblings`);
        if (!response.ok) {
          const errorData = await response.json();
          const parsedError = ErrorResponseSchema.safeParse(errorData);
          throw new Error(
            parsedError.success
              ? parsedError.data.error
              : `API error: ${response.status}`
          );
        }

        const data = await response.json();
        const parsed = SiblingsResponseSchema.safeParse(data);

        if (!parsed.success) {
          throw new Error('Invalid siblings response');
        }

        setState((prevState) => ({
          siblingsCache: {
            ...prevState.siblingsCache,
            [messageId]: parsed.data.messages,
          },
        }));
      } catch (error) {
        setState({
          error: {
            message: String(error),
            code: 'FETCH_SIBLINGS_ERROR',
          }
        });
      }
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
    (content: string, onConversationCreated?: (id: string) => void) =>
      store.sendMessage(content, onConversationCreated),
    [store]
  );
  const switchConversation = useCallback(
    (id: string) => store.switchConversation(id),
    [store]
  );
  const createConversation = useCallback(
    (assistantId: string) => store.createConversation(assistantId),
    [store]
  );
  const abort = useCallback(() => store.abort(), [store]);
  const editMessage = useCallback(
    (messageId: string, newContent: string) => store.editMessage(messageId, newContent),
    [store]
  );
  const switchBranch = useCallback(
    (parentId: string | null, targetMessageId: string) => store.switchBranch(parentId, targetMessageId),
    [store]
  );
  const fetchSiblings = useCallback(
    (messageId: string) => store.fetchSiblings(messageId),
    [store]
  );

  return {
    ...state,
    sendMessage,
    switchConversation,
    createConversation,
    abort,
    editMessage,
    switchBranch,
    fetchSiblings,
  };
}
