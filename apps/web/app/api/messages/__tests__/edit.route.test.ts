import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../[id]/edit/route';
import { createServerClient } from '@ai-life-os/supabase';
import { editMessageOperation } from '@ai-life-os/ai';

vi.mock('@ai-life-os/supabase', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@ai-life-os/ai', () => ({
  editMessageOperation: vi.fn(),
}));

vi.mock('../../../../../lib/api/auth-helpers', () => ({
  validateMessageAccess: vi.fn(),
}));

describe('POST /api/messages/[id]/edit', () => {
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

  it('should return streaming response on successful edit', async () => {
    const { validateMessageAccess } = await import('../../../../../lib/api/auth-helpers');
    vi.mocked(validateMessageAccess).mockResolvedValue({ valid: true });

    const mockGenerator = async function* () {
      yield { content: 'partial response' };
      yield { content: 'complete response' };
    };
    vi.mocked(editMessageOperation).mockReturnValue(mockGenerator() as any);

    const request = new Request('http://localhost/api/messages/msg-1/edit', {
      method: 'POST',
      body: JSON.stringify({ newContent: 'edited content' }),
      headers: { 'Content-Type': 'application/json' },
    });
    request.signal.addEventListener = vi.fn();

    const params = Promise.resolve({ id: 'msg-1' });
    const response = await POST(request, { params });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(validateMessageAccess).toHaveBeenCalledWith(mockClient, 'msg-1');
    expect(editMessageOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        client: mockClient,
        messageId: 'msg-1',
        newContent: 'edited content',
      })
    );
  });

  it('should return 404 when message not found', async () => {
    const { validateMessageAccess } = await import('../../../../../lib/api/auth-helpers');
    vi.mocked(validateMessageAccess).mockResolvedValue({
      valid: false,
      response: new Response(
        JSON.stringify({ error: 'Message not found', code: 'NOT_FOUND' }),
        { status: 404 }
      ),
    });

    const request = new Request('http://localhost/api/messages/invalid/edit', {
      method: 'POST',
      body: JSON.stringify({ newContent: 'content' }),
    });
    request.signal.addEventListener = vi.fn();

    const params = Promise.resolve({ id: 'invalid' });
    const response = await POST(request, { params });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.code).toBe('NOT_FOUND');
  });

  it('should return 400 when request body is invalid', async () => {
    const { validateMessageAccess } = await import('../../../../../lib/api/auth-helpers');
    vi.mocked(validateMessageAccess).mockResolvedValue({ valid: true });

    const request = new Request('http://localhost/api/messages/msg-1/edit', {
      method: 'POST',
      body: JSON.stringify({ invalidField: 'value' }),
    });
    request.signal.addEventListener = vi.fn();

    const params = Promise.resolve({ id: 'msg-1' });
    const response = await POST(request, { params });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('should return 401 when user is not authenticated', async () => {
    const { validateMessageAccess } = await import('../../../../../lib/api/auth-helpers');
    vi.mocked(validateMessageAccess).mockResolvedValue({
      valid: false,
      response: new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }),
        { status: 401 }
      ),
    });

    const request = new Request('http://localhost/api/messages/msg-1/edit', {
      method: 'POST',
      body: JSON.stringify({ newContent: 'content' }),
    });
    request.signal.addEventListener = vi.fn();

    const params = Promise.resolve({ id: 'msg-1' });
    const response = await POST(request, { params });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.code).toBe('UNAUTHORIZED');
  });
});
