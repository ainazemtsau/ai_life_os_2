import { ChatPanel } from '@ai-life-os/ui';

interface ChatConversationPageProps {
  params: Promise<{
    conversationId: string;
  }>;
}

export default async function ChatConversationPage({
  params,
}: ChatConversationPageProps) {
  const { conversationId } = await params;
  return <ChatPanel conversationId={conversationId} />;
}
