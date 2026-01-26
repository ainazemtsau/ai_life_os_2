import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createServerClient,
  getUserAssistants,
  createAssistant,
} from '@ai-life-os/supabase';
import { AssistantSchema } from '@ai-life-os/contracts';

const CreateAssistantSchema = AssistantSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  metadata: true,
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
    const assistants = await getUserAssistants(client, userId);

    return NextResponse.json({ assistants });
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
    const data = CreateAssistantSchema.parse(body);

    const client = await createServerClient();
    const assistant = await createAssistant(client, data);

    return NextResponse.json({ assistant });
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
