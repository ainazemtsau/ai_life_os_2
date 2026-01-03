/**
 * Chat message types for WebSocket communication.
 * Synchronized with backend API at ws://localhost:8000/chat
 */

// ============================================
// Outgoing Messages (Client → Server)
// ============================================

export interface OutgoingMessage {
  type: "message.send" | "message";
  content: string;
  user_id?: string;
  /** Request ID for tracking stream lifecycle */
  request_id?: string;
}

// ============================================
// Incoming Messages (Server → Client)
// ============================================

export interface ThinkingMessage {
  type: "thinking";
}

export interface AIResponseMessage {
  type: "ai_response";
  content: string;
}

export interface MessageNewMessage {
  type: "message.new";
  message: {
    id: string;
    role: string;
    content: string;
    agent_name?: string;
  };
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export interface CollectionCreatedMessage {
  type: "collection_created";
  collection: Record<string, unknown>;
}

export interface EntityCreatedMessage {
  type: "entity_created";
  collection: string;
  entity: Record<string, unknown>;
}

export interface EntityUpdatedMessage {
  type: "entity_updated";
  collection: string;
  entity: Record<string, unknown>;
}

export interface EntityDeletedMessage {
  type: "entity_deleted";
  collection: string;
  entity_id: string;
}

export type IncomingMessage =
  | ThinkingMessage
  | AIResponseMessage
  | MessageNewMessage
  | ErrorMessage
  | CollectionCreatedMessage
  | EntityCreatedMessage
  | EntityUpdatedMessage
  | EntityDeletedMessage;

// ============================================
// Type Guards
// ============================================

export function isThinkingMessage(msg: IncomingMessage): msg is ThinkingMessage {
  return msg.type === "thinking";
}

export function isAIResponseMessage(msg: IncomingMessage): msg is AIResponseMessage {
  return msg.type === "ai_response";
}

export function isMessageNewMessage(msg: IncomingMessage): msg is MessageNewMessage {
  return msg.type === "message.new";
}

export function isErrorMessage(msg: IncomingMessage): msg is ErrorMessage {
  return msg.type === "error";
}
