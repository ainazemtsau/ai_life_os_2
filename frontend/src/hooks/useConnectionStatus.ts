/**
 * Hook for tracking WebSocket connection status.
 */

import { useEffect, useState } from "react";
import { webSocketService } from "@/services/WebSocketService";

export function useConnectionStatus(): boolean {
  const [isConnected, setIsConnected] = useState(webSocketService.isConnected);

  useEffect(() => {
    const unsubscribe = webSocketService.onStatusChange(setIsConnected);
    return unsubscribe;
  }, []);

  return isConnected;
}
