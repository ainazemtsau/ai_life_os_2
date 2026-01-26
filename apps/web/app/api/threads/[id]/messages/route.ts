import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getConversationMessages } from '@ai-life-os/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await createServerClient();

    const { data: conversation, error: convError } = await client
      .from('conversations')
      .select('id')
      .eq('id', id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const messages = await getConversationMessages(client, id);
    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
