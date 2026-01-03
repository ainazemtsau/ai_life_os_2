/**
 * Connection Lifecycle Manager.
 *
 * Solves React StrictMode issue where double mount/unmount
 * causes premature WebSocket disconnection.
 *
 * Uses Reference Counting pattern - connection stays open
 * as long as at least one consumer exists.
 */

/**
 * Configuration for connection lifecycle behavior.
 */
export interface ConnectionLifecycleConfig {
  /**
   * Delay before actual disconnect after last consumer releases.
   * Handles React StrictMode's rapid unmount/remount cycle.
   */
  readonly disconnectDelayMs: number;
}

/**
 * Default configuration values.
 * Extracted as named constant for clarity and testability.
 */
const DEFAULT_LIFECYCLE_CONFIG: ConnectionLifecycleConfig = {
  disconnectDelayMs: 1000,
};

/**
 * Manages connection lifecycle using reference counting.
 *
 * Example usage:
 * ```typescript
 * const lifecycle = new ConnectionLifecycleManager(
 *   () => socket.connect(),
 *   () => socket.disconnect(),
 * );
 *
 * // In React component:
 * useEffect(() => {
 *   lifecycle.acquire();
 *   return () => lifecycle.release();
 * }, []);
 * ```
 */
export class ConnectionLifecycleManager {
  private referenceCount = 0;
  private pendingDisconnect: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly onConnect: () => void,
    private readonly onDisconnect: () => void,
    private readonly config: ConnectionLifecycleConfig = DEFAULT_LIFECYCLE_CONFIG,
  ) {}

  /**
   * Register a consumer that needs the connection.
   * Connection is established on first consumer.
   *
   * @returns Cleanup function that releases the connection
   */
  acquire(): () => void {
    this.cancelPendingDisconnect();
    this.referenceCount++;

    const isFirstConsumer = this.referenceCount === 1;
    if (isFirstConsumer) {
      this.onConnect();
    }

    return () => this.release();
  }

  /**
   * Release connection from a consumer.
   * Schedules disconnect if no consumers remain.
   */
  release(): void {
    this.referenceCount = Math.max(0, this.referenceCount - 1);

    const noConsumersRemain = this.referenceCount === 0;
    if (noConsumersRemain) {
      this.scheduleDisconnect();
    }
  }

  /**
   * Current number of active consumers.
   * Useful for debugging and testing.
   */
  get consumerCount(): number {
    return this.referenceCount;
  }

  /**
   * Whether a disconnect is pending.
   */
  get hasPendingDisconnect(): boolean {
    return this.pendingDisconnect !== null;
  }

  private scheduleDisconnect(): void {
    this.pendingDisconnect = setTimeout(() => {
      this.pendingDisconnect = null;

      const stillNoConsumers = this.referenceCount === 0;
      if (stillNoConsumers) {
        this.onDisconnect();
      }
    }, this.config.disconnectDelayMs);
  }

  private cancelPendingDisconnect(): void {
    if (this.pendingDisconnect) {
      clearTimeout(this.pendingDisconnect);
      this.pendingDisconnect = null;
    }
  }
}
