/**
 * Chat Runtime Provider - initializes assistant-ui runtime with WebSocket adapter.
 * 
 * Dependency Inversion: Components depend on this abstraction.
 */

import { type ReactNode, useEffect, useMemo } from "react";
import { AssistantRuntimeProvider, useLocalRuntime } from "@assistant-ui/react";
import { WebSocketChatAdapter } from "@/adapters/ChatModelAdapter";
import { webSocketService } from "@/services/WebSocketService";

interface ChatRuntimeProviderProps {
  children: ReactNode;
}

export function ChatRuntimeProvider({ children }: ChatRuntimeProviderProps) {
  const adapter = useMemo(() => new WebSocketChatAdapter(), []);
  const runtime = useLocalRuntime(adapter);

  // Connect WebSocket on mount
  useEffect(() => {
    webSocketService.connect();
    
    return () => {
      webSocketService.disconnect();
    };
  }, []);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
