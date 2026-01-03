/**
 * WebSocket Chat Model Adapter.
 *
 * Bridges WebSocket streaming to assistant-ui ChatModelAdapter interface.
 * Uses async generators for real-time UI updates.
 *
 * Interface Segregation: Implements only ChatModelAdapter interface.
 */

import type {
  ChatModelAdapter,
  ChatModelRunOptions,
  ChatModelRunResult,
} from "@assistant-ui/react";
import { webSocketService } from "@/services/WebSocketService";
import { createStreamIterator } from "@/services/streaming";
import {
  StreamEventGuards,
  type StreamEvent,
  type RequestId,
} from "@/types/streaming";

/**
 * Configuration for the chat adapter.
 */
interface ChatAdapterConfig {
  /** Generate unique request IDs */
  readonly generateRequestId: () => RequestId;
}

/**
 * Default configuration using crypto.randomUUID.
 */
const DEFAULT_CONFIG: ChatAdapterConfig = {
  generateRequestId: () => crypto.randomUUID(),
};

/**
 * Adapter that connects WebSocket streaming to assistant-ui.
 *
 * Features:
 * - Real-time streaming (shows text as it's generated)
 * - Abort signal support (cancel ongoing requests)
 * - Type-safe event handling
 *
 * @example
 * ```typescript
 * const adapter = new WebSocketChatAdapter();
 * const runtime = useLocalRuntime(adapter);
 * ```
 */
export class WebSocketChatAdapter implements ChatModelAdapter {
  private readonly config: ChatAdapterConfig;

  constructor(config: Partial<ChatAdapterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Run the chat model with streaming response.
   *
   * This is an async generator that yields partial results
   * as they arrive from the backend.
   */
  async *run(options: ChatModelRunOptions): AsyncGenerator<ChatModelRunResult> {
    console.log("[ChatAdapter] run() called with options:", options);

    const userMessage = this.extractUserMessage(options);
    if (!userMessage) {
      console.warn("[ChatAdapter] No user message extracted");
      return;
    }

    const requestId = this.config.generateRequestId();
    console.log("[ChatAdapter] Generated requestId:", requestId);
    console.log("[ChatAdapter] Sending message:", userMessage);

    this.sendMessage(requestId, userMessage);

    console.log("[ChatAdapter] Waiting for stream events...");
    yield* this.processStreamEvents(requestId, options.abortSignal);
  }

  /**
   * Extract text content from the last user message.
   */
  private extractUserMessage(options: ChatModelRunOptions): string | null {
    const { messages } = options;
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage || lastMessage.role !== "user") {
      return null;
    }

    const textContent = lastMessage.content.find(
      (part) => part.type === "text",
    );

    return textContent?.type === "text" ? textContent.text : null;
  }

  /**
   * Send message to backend via WebSocket.
   */
  private sendMessage(requestId: RequestId, content: string): void {
    webSocketService.send({
      type: "message.send",
      content,
      request_id: requestId,
    });
  }

  /**
   * Process incoming stream events and yield results.
   */
  private async *processStreamEvents(
    requestId: RequestId,
    abortSignal?: AbortSignal,
  ): AsyncGenerator<ChatModelRunResult> {
    const streamIterator = createStreamIterator(
      webSocketService.streamObserver,
      requestId,
      abortSignal,
    );

    for await (const event of streamIterator) {
      const result = this.eventToResult(event);
      if (result) {
        yield result;
      }

      if (StreamEventGuards.isTerminal(event)) {
        return;
      }
    }
  }

  /**
   * Convert stream event to ChatModelRunResult.
   *
   * Returns null for events that don't produce visible output.
   */
  private eventToResult(event: StreamEvent): ChatModelRunResult | null {
    if (StreamEventGuards.isChunk(event)) {
      return this.createTextResult(event.accumulated);
    }

    if (StreamEventGuards.isEnd(event)) {
      return this.createTextResult(event.message.content);
    }

    if (StreamEventGuards.isError(event)) {
      return this.createTextResult(`Error: ${event.error}`);
    }

    // stream.start doesn't produce visible output
    return null;
  }

  /**
   * Create a text result in assistant-ui format.
   */
  private createTextResult(text: string): ChatModelRunResult {
    return {
      content: [{ type: "text" as const, text }],
    };
  }
}
