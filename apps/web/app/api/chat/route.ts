import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createConversation } from '@ai-life-os/supabase';
import { chatWorkflow } from '@ai-life-os/ai';
import { createTextStream } from '@/lib/stream-utils';

const CreateChatSchema = z.object({
  content: z.string().min(1),
  assistantId: z.string().uuid(),
  userId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, assistantId, userId } = CreateChatSchema.parse(body);

    const client = await createServerClient();

    const conversation = await createConversation(client, {
      userId,
      assistantId,
    });

    const stream = chatWorkflow({
      client,
      conversationId: conversation.id,
      content,
      abortSignal: request.signal,
    });

    return new Response(createTextStream(stream), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
