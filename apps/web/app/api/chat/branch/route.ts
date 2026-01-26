import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@ai-life-os/supabase';
import { branchWorkflow } from '@ai-life-os/ai';
import { createTextStream } from '@/lib/stream-utils';

const BranchSchema = z.object({
  originalMessageId: z.string().uuid(),
  newContent: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { originalMessageId, newContent } = BranchSchema.parse(body);

    const client = await createServerClient();

    const { data: message, error } = await client
      .from('messages')
      .select('id')
      .eq('id', originalMessageId)
      .single();

    if (error || !message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    const stream = branchWorkflow({
      client,
      originalMessageId,
      newContent,
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
