/**
 * Stream Observer.
 *
 * Manages subscriptions to stream events using Observer pattern.
 * Provides loose coupling between WebSocket messages and stream consumers.
 */

import type { StreamEvent, RequestId } from "@/types/streaming";

/**
 * Callback function for handling stream events.
 */
export type StreamEventCallback = (event: StreamEvent) => void;

/**
 * Manages stream event subscriptions.
 *
 * Each request ID can have multiple subscribers.
 * Automatically cleans up empty subscription sets.
 *
 * @example
 * ```typescript
 * const observer = new StreamObserver();
 *
 * // Subscribe to a specific request
 * const unsubscribe = observer.subscribe("req-123", (event) => {
 *   console.log("Received:", event.type);
 * });
 *
 * // Dispatch event to subscribers
 * observer.dispatch({ type: "stream.chunk", requestId: "req-123", ... });
 *
 * // Cleanup when done
 * unsubscribe();
 * ```
 */
export class StreamObserver {
  private readonly subscriptions = new Map<RequestId, Set<StreamEventCallback>>();

  /**
   * Subscribe to events for a specific request.
   *
   * @param requestId - The request ID to subscribe to
   * @param callback - Function to call when events arrive
   * @returns Unsubscribe function
   */
  subscribe(requestId: RequestId, callback: StreamEventCallback): () => void {
    const callbacks = this.getOrCreateCallbackSet(requestId);
    callbacks.add(callback);

    return () => {
      callbacks.delete(callback);
      this.cleanupIfEmpty(requestId);
    };
  }

  /**
   * Dispatch event to all subscribers of the request.
   *
   * @param event - The stream event to dispatch
   */
  dispatch(event: StreamEvent): void {
    const callbacks = this.subscriptions.get(event.requestId);
    if (!callbacks) {
      return;
    }

    callbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error("[StreamObserver] Callback error:", error);
      }
    });
  }

  /**
   * Check if there are any subscribers for a request.
   */
  hasSubscribers(requestId: RequestId): boolean {
    const callbacks = this.subscriptions.get(requestId);
    return callbacks !== undefined && callbacks.size > 0;
  }

  /**
   * Get the number of subscribers for a request.
   * Useful for debugging.
   */
  subscriberCount(requestId: RequestId): number {
    return this.subscriptions.get(requestId)?.size ?? 0;
  }

  /**
   * Clear all subscriptions for a request.
   * Use when a request is cancelled or completed.
   */
  clear(requestId: RequestId): void {
    this.subscriptions.delete(requestId);
  }

  private getOrCreateCallbackSet(requestId: RequestId): Set<StreamEventCallback> {
    let callbacks = this.subscriptions.get(requestId);
    if (!callbacks) {
      callbacks = new Set();
      this.subscriptions.set(requestId, callbacks);
    }
    return callbacks;
  }

  private cleanupIfEmpty(requestId: RequestId): void {
    const callbacks = this.subscriptions.get(requestId);
    if (callbacks?.size === 0) {
      this.subscriptions.delete(requestId);
    }
  }
}
