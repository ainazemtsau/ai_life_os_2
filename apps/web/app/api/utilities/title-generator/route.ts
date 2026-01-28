import { NextResponse } from 'next/server';
import { TitleGeneratorInputSchema } from '@ai-life-os/contracts';
import { generateAITitle } from '@ai-life-os/ai';
import { createServerClient, updateConversationTitle } from '@ai-life-os/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = TitleGeneratorInputSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { conversationId, messages } = validation.data;

    const title = await generateAITitle(messages);

    const supabase = await createServerClient();
    const updated = await updateConversationTitle(
      supabase,
      conversationId,
      title
    );

    if (!updated) {
      return NextResponse.json(
        {
          title,
          updated: false,
          reason: 'Title was manually edited',
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ title, updated: true }, { status: 200 });
  } catch (error) {
    console.error('Title generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate title',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
