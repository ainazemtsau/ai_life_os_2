import { NextRequest, NextResponse } from 'next/server';
import {
  createServerClient,
  deleteConversation,
  updateConversation,
  setTitleManuallyEdited,
} from '@ai-life-os/supabase';
import { validateTitle } from '@ai-life-os/contracts';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await createServerClient();

    const { data: conversation, error: fetchError } = await client
      .from('conversations')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    await deleteConversation(client, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title } = body;

    if (typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Title must be a string' },
        { status: 400 }
      );
    }

    const validation = validateTitle(title);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const client = await createServerClient();

    const { data: conversation, error: fetchError } = await client
      .from('conversations')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    await updateConversation(client, id, { title: title.trim() });
    await setTitleManuallyEdited(client, id);

    return NextResponse.json({ success: true, title: title.trim() });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
