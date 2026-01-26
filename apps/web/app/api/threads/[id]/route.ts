import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, deleteConversation } from '@ai-life-os/supabase';

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
