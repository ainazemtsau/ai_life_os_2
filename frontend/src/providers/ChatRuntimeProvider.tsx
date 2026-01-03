/**
 * Chat Runtime Provider.
 *
 * Initializes assistant-ui runtime with WebSocket adapter.
 * Manages WebSocket connection lifecycle for React StrictMode compatibility.
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

/**
 * Provides chat runtime context to child components.
 *
 * Handles WebSocket connection lifecycle using reference counting
 * to properly handle React StrictMode's double mount/unmount.
 */
export function ChatRuntimeProvider({ children }: ChatRuntimeProviderProps) {
  console.log("[ChatRuntimeProvider] Creating adapter...");
  const adapter = useMemo(() => {
    console.log("[ChatRuntimeProvider] useMemo: creating new WebSocketChatAdapter");
    return new WebSocketChatAdapter();
  }, []);

  console.log("[ChatRuntimeProvider] Creating runtime with adapter:", adapter);
  const runtime = useLocalRuntime(adapter);
  console.log("[ChatRuntimeProvider] Runtime created:", runtime);

  // Manage WebSocket connection with StrictMode-safe lifecycle
  useEffect(() => {
    console.log("[ChatRuntimeProvider] useEffect: acquiring connection");
    return webSocketService.acquireConnection();
  }, []);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
