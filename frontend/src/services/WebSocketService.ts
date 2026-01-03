/**
 * WebSocket Service.
 *
 * Manages WebSocket connection to chat backend.
 * Integrates with ConnectionLifecycleManager for React StrictMode support.
 * Provides StreamObserver for handling streaming events.
 */

import type { IncomingMessage, OutgoingMessage } from "@/types/chat";
import { isStreamEvent, type StreamEvent } from "@/types/streaming";
import { ConnectionLifecycleManager } from "./connection";
import { StreamObserver } from "./streaming";

/**
 * Configuration for WebSocket service.
 */
export interface WebSocketServiceConfig {
  /** WebSocket server URL */
  readonly url: string;

  /** Initial delay before reconnection attempt (ms) */
  readonly reconnectIntervalMs: number;

  /** Maximum delay between reconnection attempts (ms) */
  readonly maxReconnectIntervalMs: number;

  /** Multiplier for exponential backoff */
  readonly reconnectDecay: number;

  /** Delay before disconnect for React StrictMode (ms) */
  readonly strictModeDelayMs: number;
}

/**
 * Default configuration.
 * All values are named constants for clarity.
 */
const DEFAULT_CONFIG: WebSocketServiceConfig = {
  url: "ws://localhost:8000/chat",
  reconnectIntervalMs: 1000,
  maxReconnectIntervalMs: 30000,
  reconnectDecay: 1.5,
  strictModeDelayMs: 1000,
};

/** Storage key for persistent user ID */
const USER_ID_STORAGE_KEY = "ai_life_os_user_id";

/** Handler for non-streaming messages (thinking, status, etc) */
type MessageHandler = (message: IncomingMessage) => void;

/** Handler for connection status changes */
type StatusHandler = (connected: boolean) => void;

/**
 * WebSocket service implementation.
 *
 * Responsibilities:
 * - Connection lifecycle management
 * - Message routing (streaming and control messages)
 * - Automatic reconnection with backoff
 * - User ID persistence
 */
class WebSocketServiceImpl {
  private ws: WebSocket | null = null;
  private readonly config: WebSocketServiceConfig;

  // Handler registries
  private readonly messageHandlers = new Set<MessageHandler>();
  private readonly statusHandlers = new Set<StatusHandler>();

  // Streaming infrastructure
  private readonly _streamObserver = new StreamObserver();

  // Connection state
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private _isConnected = false;

  // User identity
  private readonly _userId: string;

  // Lifecycle management for React StrictMode
  private readonly lifecycleManager: ConnectionLifecycleManager;

  constructor(config: Partial<WebSocketServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this._userId = this.getOrCreateUserId();

    this.lifecycleManager = new ConnectionLifecycleManager(
      () => this.connect(),
      () => this.disconnect(),
      { disconnectDelayMs: this.config.strictModeDelayMs },
    );
  }

  // ==========================================
  // Public API
  // ==========================================

  /**
   * Acquire connection for React components.
   * Handles StrictMode double mount/unmount correctly.
   *
   * @returns Cleanup function to release connection
   *
   * @example
   * ```typescript
   * useEffect(() => {
   *   return webSocketService.acquireConnection();
   * }, []);
   * ```
   */
  acquireConnection(): () => void {
    return this.lifecycleManager.acquire();
  }

  /**
   * Send message to backend.
   * Automatically includes user_id.
   */
  send(message: OutgoingMessage): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.error("[WebSocket] Cannot send - not connected, readyState:", this.ws?.readyState);
      return;
    }

    const messageWithUserId = {
      ...message,
      user_id: this._userId,
    };

    console.log("[WebSocket] Sending message:", messageWithUserId);
    this.ws.send(JSON.stringify(messageWithUserId));
  }

  /**
   * Subscribe to control messages (thinking, status updates, etc).
   * For streaming events, use streamObserver instead.
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Subscribe to connection status changes.
   * Handler is called immediately with current status.
   */
  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    handler(this._isConnected);
    return () => this.statusHandlers.delete(handler);
  }

  /**
   * Stream observer for handling streaming events.
   * Use this for new streaming-based message handling.
   */
  get streamObserver(): StreamObserver {
    return this._streamObserver;
  }

  /**
   * Current connection status.
   */
  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Persistent user ID.
   */
  get userId(): string {
    return this._userId;
  }

  // ==========================================
  // Connection Management
  // ==========================================

  private connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.shouldReconnect = true;
    this.createConnection();
  }

  private disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimeout();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setConnected(false);
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
      this.handleMessage(event);
    };
  }

  // ==========================================
  // Message Handling
  // ==========================================

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      console.log("[WebSocket] Received message:", message);

      // Route streaming events to StreamObserver
      if (isStreamEvent(message)) {
        this._streamObserver.dispatch(message as StreamEvent);
        return;
      }

      // Route control messages (thinking, status) to handlers
      this.notifyMessageHandlers(message as IncomingMessage);
    } catch (error) {
      console.error("[WebSocket] Failed to parse message:", error);
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

  // ==========================================
  // Status Management
  // ==========================================

  private setConnected(connected: boolean): void {
    if (this._isConnected !== connected) {
      this._isConnected = connected;
      this.notifyStatusHandlers(connected);
    }
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

  // ==========================================
  // Reconnection Logic
  // ==========================================

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    this.clearReconnectTimeout();

    const delay = this.calculateReconnectDelay();

    console.log(
      `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`,
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.createConnection();
    }, delay);
  }

  private calculateReconnectDelay(): number {
    const exponentialDelay =
      this.config.reconnectIntervalMs *
      Math.pow(this.config.reconnectDecay, this.reconnectAttempts);

    return Math.min(exponentialDelay, this.config.maxReconnectIntervalMs);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  // ==========================================
  // User ID Management
  // ==========================================

  private getOrCreateUserId(): string {
    let userId = localStorage.getItem(USER_ID_STORAGE_KEY);

    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem(USER_ID_STORAGE_KEY, userId);
    }

    return userId;
  }
}

/** Singleton WebSocket service instance */
export const webSocketService = new WebSocketServiceImpl();

/** Export class for testing */
export { WebSocketServiceImpl };
