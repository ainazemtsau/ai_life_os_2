import { streamText } from 'ai';
import { getModel, getContextWindow } from '../config';
import { buildSystemPrompt, DEFAULT_SYSTEM_PROMPT } from '../prompts';
import {
  createMessage,
  updateMessage,
  getConversationMessages,
} from '@ai-life-os/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@ai-life-os/supabase';
import { truncateContext } from '../utils/context-truncation';
import { withRetry } from '../utils/retry';
import { createTokenTracker, createErrorLogger } from '../utils/observability';
import type { SSEEvent } from '@ai-life-os/contracts';

export interface ChatWorkflowInput {
  client: SupabaseClient<Database>;
  conversationId: string;
  content: string;
  abortSignal?: AbortSignal;
  parentMessageId?: string | null;
  skipUserMessage?: boolean;
}

export async function* chatWorkflow(input: ChatWorkflowInput): AsyncGenerator<SSEEvent> {
  const { client, conversationId, content, abortSignal, parentMessageId, skipUserMessage } = input;

  const { data: conversation, error: convError } = await client
    .from('conversations')
    .select('assistant_id')
    .eq('id', conversationId)
    .single();

  if (convError) throw convError;

  const { data: assistant, error: assistantError } = await client
    .from('assistants')
    .select('*')
    .eq('id', conversation.assistant_id)
    .single();

  if (assistantError) throw assistantError;

  if (skipUserMessage && !parentMessageId) {
    throw new Error('skipUserMessage requires parentMessageId to be set');
  }

  let userMessageId: string;
  if (skipUserMessage) {
    userMessageId = parentMessageId!;
  } else {
    const userMessage = await createMessage(client, {
      conversationId,
      parentId: parentMessageId,
      content,
      role: 'user',
      status: 'complete',
    });
    userMessageId = userMessage.id;
  }

  const assistantMessage = await createMessage(client, {
    conversationId,
    parentId: userMessageId,
    content: '',
    role: 'assistant',
    status: 'pending',
  });

  // Emit metadata event with message IDs for client-side optimistic updates
  yield {
    type: 'meta',
    userMessageId,
    assistantMessageId: assistantMessage.id,
  };

  try {
    const messages = await getConversationMessages(client, conversationId);
    const systemPrompt = buildSystemPrompt(
      assistant.system_prompt || DEFAULT_SYSTEM_PROMPT,
      null
    );

    const contextWindow = getContextWindow(assistant.model);
    const truncated = truncateContext(
      messages.map((m) => ({ role: m.role, content: m.content })),
      systemPrompt,
      contextWindow,
      4
    );

    const model = getModel(assistant.model);

    const tokenTracker = createTokenTracker({
      client,
      conversationId,
      messageId: assistantMessage.id,
      model: assistant.model,
    });
    const errorLogger = createErrorLogger('chatWorkflow');

    const result = await withRetry(async () =>
      streamText({
        model,
        system: systemPrompt,
        messages: truncated,
        temperature: Number(assistant.temperature),
        maxTokens: assistant.max_tokens ?? undefined,
        abortSignal,
        onFinish: tokenTracker,
        onError: errorLogger,
      })
    );

    await updateMessage(client, assistantMessage.id, { status: 'streaming' });

    let fullContent = '';
    let lastSaveTime = Date.now();
    for await (const chunk of result.textStream) {
      fullContent += chunk;
      yield { type: 'chunk', content: chunk };
      if (Date.now() - lastSaveTime > 500) {
        await updateMessage(client, assistantMessage.id, { content: fullContent });
        lastSaveTime = Date.now();
      }
    }

    // Emit complete event with full content
    yield { type: 'complete', content: fullContent };

    await updateMessage(client, assistantMessage.id, {
      content: fullContent,
      status: 'complete',
    });
  } catch (error) {
    if (abortSignal?.aborted) {
      await updateMessage(client, assistantMessage.id, { status: 'stopped' });
    } else {
      await updateMessage(client, assistantMessage.id, {
        status: 'error',
        metadata: { error: String(error) },
      });
    }
    throw error;
  }
}
