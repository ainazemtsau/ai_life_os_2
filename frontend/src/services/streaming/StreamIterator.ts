/**
 * Stream Iterator.
 *
 * Bridges callback-based WebSocket events to async/await pattern.
 * Required by assistant-ui ChatModelAdapter interface.
 */

import type { StreamEvent, RequestId } from "@/types/streaming";
import { StreamEventGuards } from "@/types/streaming";
import type { StreamObserver } from "./StreamObserver";

/**
 * Creates an async iterator from stream events.
 *
 * Transforms push-based WebSocket events into pull-based async iteration.
 * Handles buffering, terminal events, and abort signals.
 *
 * @param observer - StreamObserver to subscribe to
 * @param requestId - Request ID to listen for
 * @param abortSignal - Optional signal to cancel iteration
 * @returns Async iterator of stream events
 *
 * @example
 * ```typescript
 * const iterator = createStreamIterator(observer, "req-123", abortSignal);
 *
 * for await (const event of iterator) {
 *   if (StreamEventGuards.isChunk(event)) {
 *     console.log("Content:", event.accumulated);
 *   }
 * }
 * ```
 */
export function createStreamIterator(
  observer: StreamObserver,
  requestId: RequestId,
  abortSignal?: AbortSignal,
): AsyncIterableIterator<StreamEvent> {
  /** Queue for events received before they're consumed */
  const eventQueue: StreamEvent[] = [];

  /** Resolver for pending next() call */
  let pendingResolver: ((result: IteratorResult<StreamEvent>) => void) | null = null;

  /** Whether the stream has ended (terminal event received or aborted) */
  let isComplete = false;

  /** Unsubscribe function from observer */
  let unsubscribe: (() => void) | null = null;

  /**
   * Handle incoming stream event.
   */
  const handleEvent = (event: StreamEvent): void => {
    if (isComplete) {
      return;
    }

    const isTerminal = StreamEventGuards.isTerminal(event);
    if (isTerminal) {
      isComplete = true;
    }

    // If there's a pending next() call, resolve it immediately
    if (pendingResolver) {
      pendingResolver({ value: event, done: false });
      pendingResolver = null;
    } else {
      // Otherwise queue the event
      eventQueue.push(event);
    }
  };

  /**
   * Handle abort signal.
   */
  const handleAbort = (): void => {
    isComplete = true;
    cleanup();

    // Resolve any pending next() with done
    if (pendingResolver) {
      pendingResolver({ value: undefined as unknown as StreamEvent, done: true });
      pendingResolver = null;
    }
  };

  /**
   * Cleanup subscriptions.
   */
  const cleanup = (): void => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };

  // Set up subscriptions
  unsubscribe = observer.subscribe(requestId, handleEvent);

  if (abortSignal) {
    abortSignal.addEventListener("abort", handleAbort, { once: true });
  }

  return {
    [Symbol.asyncIterator]() {
      return this;
    },

    async next(): Promise<IteratorResult<StreamEvent>> {
      // Return queued events first
      if (eventQueue.length > 0) {
        const event = eventQueue.shift()!;
        return { value: event, done: false };
      }

      // If stream is complete, signal done
      if (isComplete) {
        cleanup();
        return { value: undefined as unknown as StreamEvent, done: true };
      }

      // Wait for next event
      return new Promise((resolve) => {
        pendingResolver = resolve;
      });
    },

    async return(): Promise<IteratorResult<StreamEvent>> {
      // Called when consumer breaks out of for-await loop
      isComplete = true;
      cleanup();
      return { value: undefined as unknown as StreamEvent, done: true };
    },
  };
}
