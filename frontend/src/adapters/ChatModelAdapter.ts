/**
 * Chat Model Adapter for assistant-ui.
 * 
 * Converts WebSocket messages to assistant-ui format.
 * Interface Segregation: implements only ChatModelAdapter interface.
 */

import type { ChatModelAdapter, ChatModelRunOptions, ChatModelRunResult } from "@assistant-ui/react";
import { webSocketService } from "@/services/WebSocketService";
import type { IncomingMessage, OutgoingMessage } from "@/types/chat";

export class WebSocketChatAdapter implements ChatModelAdapter {
  async *run(options: ChatModelRunOptions): AsyncGenerator<ChatModelRunResult> {
    const { messages, abortSignal } = options;

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "user") {
      return;
    }

    // Extract text content from user message
    const textContent = lastMessage.content.find((part) => part.type === "text");
    if (!textContent || textContent.type !== "text") {
      return;
    }

    const userText = textContent.text;

    // Create promise-based message handler
    const responsePromise = new Promise<string>((resolve, reject) => {
      let isThinking = false;

      const handleMessage = (msg: IncomingMessage) => {
        if (msg.type === "thinking") {
          isThinking = true;
        } else if (msg.type === "ai_response") {
          unsubscribe();
          resolve(msg.content);
        } else if (msg.type === "error") {
          unsubscribe();
          reject(new Error(msg.message));
        }
      };

      const unsubscribe = webSocketService.onMessage(handleMessage);

      // Handle abort
      if (abortSignal) {
        abortSignal.addEventListener("abort", () => {
          unsubscribe();
          reject(new Error("Request aborted"));
        });
      }

      // Send message to backend
      const outgoing: OutgoingMessage = {
        type: "message",
        content: userText,
      };
      webSocketService.send(outgoing);
    });

    try {
      const response = await responsePromise;
      
      yield {
        content: [
          {
            type: "text" as const,
            text: response,
          },
        ],
      };
    } catch (error) {
      if (error instanceof Error && error.message !== "Request aborted") {
        yield {
          content: [
            {
              type: "text" as const,
              text: "Error: " + error.message,
            },
          ],
        };
      }
    }
  }
}
