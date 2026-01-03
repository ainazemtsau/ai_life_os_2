/**
 * WebSocket Service - manages connection to chat backend.
 * 
 * Single Responsibility: Only handles WebSocket connection lifecycle.
 * Open/Closed: Extensible via event handlers.
 */

import type { IncomingMessage, OutgoingMessage } from "@/types/chat";

type MessageHandler = (message: IncomingMessage) => void;
type StatusHandler = (connected: boolean) => void;

interface WebSocketServiceConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectInterval: number;
  reconnectDecay: number;
}

const DEFAULT_CONFIG: WebSocketServiceConfig = {
  url: "ws://localhost:8000/chat",
  reconnectInterval: 1000,
  maxReconnectInterval: 30000,
  reconnectDecay: 1.5,
};

class WebSocketServiceImpl {
  private ws: WebSocket | null = null;
  private config: WebSocketServiceConfig;
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private _isConnected = false;

  constructor(config: Partial<WebSocketServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }
    this.shouldReconnect = true;
    this.createConnection();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimeout();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setConnected(false);
  }

  send(message: OutgoingMessage): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.error("[WebSocket] Cannot send - not connected");
      return;
    }
    this.ws.send(JSON.stringify(message));
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    handler(this._isConnected);
    return () => this.statusHandlers.delete(handler);
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  private createConnection(): void {
    try {
      this.ws = new WebSocket(this.config.url);
      this.setupEventListeners();
    } catch (error) {
      console.error("[WebSocket] Failed to create connection:", error);
      this.scheduleReconnect();
    }
  }

  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log("[WebSocket] Connected");
      this.reconnectAttempts = 0;
      this.setConnected(true);
    };

    this.ws.onclose = (event) => {
      console.log("[WebSocket] Disconnected:", event.code, event.reason);
      this.setConnected(false);
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error("[WebSocket] Error:", error);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as IncomingMessage;
        this.notifyMessageHandlers(message);
      } catch (error) {
        console.error("[WebSocket] Failed to parse message:", error);
      }
    };
  }

  private setConnected(connected: boolean): void {
    if (this._isConnected !== connected) {
      this._isConnected = connected;
      this.notifyStatusHandlers(connected);
    }
  }

  private notifyMessageHandlers(message: IncomingMessage): void {
    this.messageHandlers.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        console.error("[WebSocket] Message handler error:", error);
      }
    });
  }

  private notifyStatusHandlers(connected: boolean): void {
    this.statusHandlers.forEach((handler) => {
      try {
        handler(connected);
      } catch (error) {
        console.error("[WebSocket] Status handler error:", error);
      }
    });
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    this.clearReconnectTimeout();

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(this.config.reconnectDecay, this.reconnectAttempts),
      this.config.maxReconnectInterval
    );

    console.log("[WebSocket] Reconnecting in " + delay + "ms (attempt " + (this.reconnectAttempts + 1) + ")");

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.createConnection();
    }, delay);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}

export const webSocketService = new WebSocketServiceImpl();
export { WebSocketServiceImpl };
