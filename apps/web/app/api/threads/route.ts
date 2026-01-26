import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createServerClient,
  getUserConversations,
  createConversation,
} from '@ai-life-os/supabase';

const CreateThreadSchema = z.object({
  userId: z.string().uuid(),
  assistantId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId required' },
        { status: 400 }
      );
    }

    const client = await createServerClient();
    const conversations = await getUserConversations(client, userId);

    return NextResponse.json({ conversations });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, assistantId } = CreateThreadSchema.parse(body);

    const client = await createServerClient();
    const conversation = await createConversation(client, {
      userId,
      assistantId,
    });

    return NextResponse.json({ conversation });
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
