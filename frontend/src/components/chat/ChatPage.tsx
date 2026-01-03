/**
 * Chat Page - main chat interface.
 */

import { Thread } from "@/components/thread";
import { ConnectionStatus } from "./ConnectionStatus";

export function ChatPage() {
  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-xl font-semibold">AI Workspace</h1>
        <ConnectionStatus />
      </header>
      <main className="flex-1 overflow-hidden">
        <Thread />
      </main>
    </div>
  );
}
