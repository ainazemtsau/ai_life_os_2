import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@ai-life-os/supabase';
import { chatWorkflow } from '@ai-life-os/ai';
import { createTextStream } from '@/lib/stream-utils';

const SendMessageSchema = z.object({
  content: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params;
    const body = await request.json();
    const { content } = SendMessageSchema.parse(body);

    const client = await createServerClient();

    const { data: conversation, error } = await client
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .single();

    if (error || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const stream = chatWorkflow({
      client,
      conversationId,
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
