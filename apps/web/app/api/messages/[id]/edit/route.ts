import { NextRequest } from 'next/server';
import { createServerClient } from '@ai-life-os/supabase';
import { EditMessageRequestSchema } from '@ai-life-os/contracts';
import { editMessageOperation } from '@ai-life-os/ai';
import { validateMessageAccess } from '../../../../../lib/api/auth-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const validation = EditMessageRequestSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request body',
          code: 'VALIDATION_ERROR',
          details: validation.error.flatten(),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = await createServerClient();

    const authResult = await validateMessageAccess(client, id);
    if (!authResult.valid) {
      return authResult.response;
    }

    const { newContent } = validation.data;
    const abortController = new AbortController();

    request.signal.addEventListener('abort', () => {
      abortController.abort();
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of editMessageOperation({
            client,
            messageId: id,
            newContent,
            abortSignal: abortController.signal,
          })) {
            // SSE format: data: {JSON}\n\n required by processStreamResponse in chat-runtime.ts
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
            );
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
      cancel() {
        abortController.abort();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
