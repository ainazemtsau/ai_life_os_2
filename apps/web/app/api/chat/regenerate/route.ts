import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@ai-life-os/supabase';
import { regenerateWorkflow } from '@ai-life-os/ai';
import { createTextStream } from '@/lib/stream-utils';

const RegenerateSchema = z.object({
  assistantMessageId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assistantMessageId } = RegenerateSchema.parse(body);

    const client = await createServerClient();

    const { data: message, error } = await client
      .from('messages')
      .select('role')
      .eq('id', assistantMessageId)
      .single();

    if (error || !message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    if (message.role !== 'assistant') {
      return NextResponse.json(
        { error: 'Can only regenerate assistant messages' },
        { status: 400 }
      );
    }

    const stream = regenerateWorkflow({
      client,
      assistantMessageId,
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
