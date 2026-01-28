import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../[id]/siblings/route';
import { createServerClient, getSiblingMessages } from '@ai-life-os/supabase';

vi.mock('@ai-life-os/supabase', () => ({
  createServerClient: vi.fn(),
  getSiblingMessages: vi.fn(),
}));

vi.mock('../../../../../lib/api/auth-helpers', () => ({
  validateMessageAccess: vi.fn(),
}));

describe('GET /api/messages/[id]/siblings', () => {
  const mockClient = {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any);
  });

  it('should return all messages with same parent_id', async () => {
    const { validateMessageAccess } = await import('../../../../../lib/api/auth-helpers');
    vi.mocked(validateMessageAccess).mockResolvedValue({ valid: true });

    const mockSiblings = [
      {
        id: 'msg-1',
        content: 'first version',
        parent_id: 'parent-1',
        role: 'assistant',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        conversation_id: 'conv-1',
        status: 'complete',
      },
      {
        id: 'msg-2',
        content: 'second version',
        parent_id: 'parent-1',
        role: 'assistant',
        created_at: '2024-01-01T00:01:00Z',
        updated_at: '2024-01-01T00:01:00Z',
        conversation_id: 'conv-1',
        status: 'complete',
      },
      {
        id: 'msg-3',
        content: 'third version',
        parent_id: 'parent-1',
        role: 'assistant',
        created_at: '2024-01-01T00:02:00Z',
        updated_at: '2024-01-01T00:02:00Z',
        conversation_id: 'conv-1',
        status: 'complete',
      },
    ];

    vi.mocked(getSiblingMessages).mockResolvedValue(mockSiblings as any);

    const request = new Request('http://localhost/api/messages/msg-1/siblings');
    const params = Promise.resolve({ id: 'msg-1' });
    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.messages).toHaveLength(3);
    expect(data.messages[0].id).toBe('msg-1');
    expect(data.messages[1].id).toBe('msg-2');
    expect(data.messages[2].id).toBe('msg-3');
    expect(validateMessageAccess).toHaveBeenCalledWith(mockClient, 'msg-1');
    expect(getSiblingMessages).toHaveBeenCalledWith(mockClient, 'msg-1');
  });

  it('should return 404 when message not found', async () => {
    const { validateMessageAccess } = await import('../../../../../lib/api/auth-helpers');
    vi.mocked(validateMessageAccess).mockResolvedValue({
      valid: false,
      response: new Response(
        JSON.stringify({ error: 'Message not found', code: 'NOT_FOUND' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      ),
    });

    const request = new Request('http://localhost/api/messages/invalid/siblings');
    const params = Promise.resolve({ id: 'invalid' });
    const response = await GET(request, { params });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.code).toBe('NOT_FOUND');
  });

  it('should return 403 when user does not own conversation', async () => {
    const { validateMessageAccess } = await import('../../../../../lib/api/auth-helpers');
    vi.mocked(validateMessageAccess).mockResolvedValue({
      valid: false,
      response: new Response(
        JSON.stringify({ error: 'Forbidden', code: 'FORBIDDEN' }),
        { status: 403 }
      ),
    });

    const request = new Request('http://localhost/api/messages/msg-1/siblings');
    const params = Promise.resolve({ id: 'msg-1' });
    const response = await GET(request, { params });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.code).toBe('FORBIDDEN');
  });
});
