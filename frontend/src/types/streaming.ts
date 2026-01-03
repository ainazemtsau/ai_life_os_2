/**
 * Streaming Protocol Types.
 *
 * Discriminated union pattern for type-safe message handling.
 * Each type is self-documenting through JSDoc.
 */

/** Unique identifier for tracking stream lifecycle */
export type RequestId = string;

/** Message role in conversation */
export type MessageRole = "user" | "assistant" | "system";

/** Base interface for all stream events */
interface StreamEventBase {
  readonly requestId: RequestId;
}

/** Signals that streaming has started */
export interface StreamStartEvent extends StreamEventBase {
  readonly type: "stream.start";
}

/** Contains incremental content update */
export interface StreamChunkEvent extends StreamEventBase {
  readonly type: "stream.chunk";
  /** New content since last chunk */
  readonly delta: string;
  /** Full accumulated content so far */
  readonly accumulated: string;
}

/** Completed message from stream */
export interface StreamMessage {
  readonly id: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly agentName?: string;
}

/** Signals successful stream completion */
export interface StreamEndEvent extends StreamEventBase {
  readonly type: "stream.end";
  readonly message: StreamMessage;
}

/** Signals stream error */
export interface StreamErrorEvent extends StreamEventBase {
  readonly type: "stream.error";
  readonly error: string;
  /** Whether the error is recoverable (e.g., cancelled vs failed) */
  readonly recoverable: boolean;
}

/** Union of all stream events */
export type StreamEvent =
  | StreamStartEvent
  | StreamChunkEvent
  | StreamEndEvent
  | StreamErrorEvent;

/**
 * Type guards for runtime type checking.
 *
 * Usage:
 *   if (StreamEventGuards.isChunk(event)) {
 *     console.log(event.delta); // TypeScript knows event is StreamChunkEvent
 *   }
 */
export const StreamEventGuards = {
  isStart: (event: StreamEvent): event is StreamStartEvent =>
    event.type === "stream.start",

  isChunk: (event: StreamEvent): event is StreamChunkEvent =>
    event.type === "stream.chunk",

  isEnd: (event: StreamEvent): event is StreamEndEvent =>
    event.type === "stream.end",

  isError: (event: StreamEvent): event is StreamErrorEvent =>
    event.type === "stream.error",

  isTerminal: (event: StreamEvent): event is StreamEndEvent | StreamErrorEvent =>
    event.type === "stream.end" || event.type === "stream.error",
} as const;

/**
 * Check if an unknown message is a stream event.
 * Used for filtering WebSocket messages.
 */
export function isStreamEvent(message: unknown): message is StreamEvent {
  if (!message || typeof message !== "object") {
    return false;
  }

  const msg = message as Record<string, unknown>;
  const streamTypes = ["stream.start", "stream.chunk", "stream.end", "stream.error"];

  return (
    typeof msg.type === "string" &&
    streamTypes.includes(msg.type) &&
    typeof msg.requestId === "string"
  );
}
