import type { RuntimeError, ChatRuntimeState } from './chat-runtime';
import type { Message } from '@ai-life-os/contracts';

/**
 * Determines if an error is an abort error (user cancelled the request).
 */
export function isAbortError(error: unknown): boolean {
  return (error as Error).name === 'AbortError';
}

/**
 * Creates a RuntimeError from an unknown error.
 */
export function createRuntimeError(error: unknown, code: string): RuntimeError {
  return {
    message: String(error),
    code,
  };
}

/**
 * Determines the message status based on whether the error was an abort.
 */
export function getErrorMessageStatus(error: unknown): Message['status'] {
  return isAbortError(error) ? 'stopped' : 'error';
}

/**
 * Creates state update for a stream error scenario.
 * Returns null error if the request was aborted (user-initiated cancellation).
 */
export function createStreamErrorState(
  error: unknown,
  messageId: string,
  errorCode: string,
  prevState: ChatRuntimeState
): Partial<ChatRuntimeState> {
  const aborted = isAbortError(error);

  return {
    isGenerating: false,
    error: aborted ? null : createRuntimeError(error, errorCode),
    messages: prevState.messages.map((m) =>
      m.id === messageId
        ? { ...m, status: getErrorMessageStatus(error) }
        : m
    ),
  };
}

/**
 * Creates state update for marking streaming messages as errors.
 * Used when we don't know the exact message ID (e.g., during ID swapping).
 */
export function createStreamingMessageErrorState(
  error: unknown,
  errorCode: string,
  prevState: ChatRuntimeState
): Partial<ChatRuntimeState> {
  const aborted = isAbortError(error);

  return {
    isGenerating: false,
    error: aborted ? null : createRuntimeError(error, errorCode),
    messages: prevState.messages.map((m) =>
      m.role === 'assistant' && m.status === 'streaming'
        ? { ...m, status: getErrorMessageStatus(error) }
        : m
    ),
  };
}
