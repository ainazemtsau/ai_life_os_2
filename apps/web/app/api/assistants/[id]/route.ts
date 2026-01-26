import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createServerClient,
  updateAssistant,
  deleteAssistant,
} from '@ai-life-os/supabase';
import { AssistantSchema } from '@ai-life-os/contracts';

const UpdateAssistantSchema = AssistantSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  metadata: true,
}).partial();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await createServerClient();

    const { data: assistant, error } = await client
      .from('assistants')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !assistant) {
      return NextResponse.json(
        { error: 'Assistant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ assistant });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = UpdateAssistantSchema.parse(body);

    const client = await createServerClient();
    const assistant = await updateAssistant(client, id, data);

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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await createServerClient();

    await deleteAssistant(client, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
