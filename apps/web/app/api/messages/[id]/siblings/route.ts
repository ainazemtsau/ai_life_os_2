import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getSiblingMessages } from '@ai-life-os/supabase';
import { validateMessageAccess } from '../../../../../lib/api/auth-helpers';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await createServerClient();

    const authResult = await validateMessageAccess(client, id);
    if (!authResult.valid) {
      return authResult.response;
    }

    const siblings = await getSiblingMessages(client, id);

    return NextResponse.json({
      messages: siblings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
