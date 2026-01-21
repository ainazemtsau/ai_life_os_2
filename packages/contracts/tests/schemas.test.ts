import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { ChatMessageSchema, ChatSchema, AssistantSchema } from '../src/schemas';

describe('ChatMessageSchema', () => {
  it('validates correct messages', () => {
    fc.assert(fc.property(
      fc.uuid(),
      fc.uuid(),
      fc.constantFrom('user', 'assistant', 'system'),
      fc.string(),
      fc.date().map(d => d.toISOString()),
      (id, chatId, role, content, createdAt) => {
        const result = ChatMessageSchema.safeParse({ id, chatId, role, content, createdAt });
        expect(result.success).toBe(true);
      }
    ));
  });

  it('rejects invalid role', () => {
    const invalid = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      chatId: '123e4567-e89b-12d3-a456-426614174001',
      role: 'invalid',
      content: 'test',
      createdAt: new Date().toISOString()
    };
    const result = ChatMessageSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID format', () => {
    const invalid = {
      id: 'not-a-uuid',
      chatId: '123e4567-e89b-12d3-a456-426614174001',
      role: 'user',
      content: 'test',
      createdAt: new Date().toISOString()
    };
    const result = ChatMessageSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid datetime format', () => {
    const invalid = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      chatId: '123e4567-e89b-12d3-a456-426614174001',
      role: 'user',
      content: 'test',
      createdAt: 'not-a-datetime'
    };
    const result = ChatMessageSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('accepts optional metadata', () => {
    fc.assert(fc.property(
      fc.uuid(),
      fc.uuid(),
      fc.constantFrom('user', 'assistant', 'system'),
      fc.string(),
      fc.date().map(d => d.toISOString()),
      fc.dictionary(fc.string(), fc.anything()),
      (id, chatId, role, content, createdAt, metadata) => {
        const result = ChatMessageSchema.safeParse({ id, chatId, role, content, createdAt, metadata });
        expect(result.success).toBe(true);
      }
    ));
  });
});

describe('ChatSchema', () => {
  it('validates correct chat', () => {
    fc.assert(fc.property(
      fc.uuid(),
      fc.uuid(),
      fc.uuid(),
      fc.date().map(d => d.toISOString()),
      fc.date().map(d => d.toISOString()),
      (id, userId, assistantId, createdAt, updatedAt) => {
        const result = ChatSchema.safeParse({ id, userId, assistantId, createdAt, updatedAt });
        expect(result.success).toBe(true);
      }
    ));
  });

  it('accepts optional title', () => {
    fc.assert(fc.property(
      fc.uuid(),
      fc.uuid(),
      fc.uuid(),
      fc.string(),
      fc.date().map(d => d.toISOString()),
      fc.date().map(d => d.toISOString()),
      (id, userId, assistantId, title, createdAt, updatedAt) => {
        const result = ChatSchema.safeParse({ id, userId, assistantId, title, createdAt, updatedAt });
        expect(result.success).toBe(true);
      }
    ));
  });

  it('rejects missing required fields', () => {
    const invalid = {
      id: '123e4567-e89b-12d3-a456-426614174000'
    };
    const result = ChatSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('AssistantSchema', () => {
  it('validates correct assistant', () => {
    fc.assert(fc.property(
      fc.uuid(),
      fc.uuid(),
      fc.string({ minLength: 1 }),
      fc.date().map(d => d.toISOString()),
      fc.date().map(d => d.toISOString()),
      (id, userId, name, createdAt, updatedAt) => {
        const result = AssistantSchema.safeParse({ id, userId, name, createdAt, updatedAt });
        expect(result.success).toBe(true);
      }
    ));
  });

  it('rejects empty name', () => {
    const invalid = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      userId: '123e4567-e89b-12d3-a456-426614174001',
      name: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const result = AssistantSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('accepts optional description and systemPrompt', () => {
    fc.assert(fc.property(
      fc.uuid(),
      fc.uuid(),
      fc.string({ minLength: 1 }),
      fc.string(),
      fc.string(),
      fc.date().map(d => d.toISOString()),
      fc.date().map(d => d.toISOString()),
      (id, userId, name, description, systemPrompt, createdAt, updatedAt) => {
        const result = AssistantSchema.safeParse({
          id, userId, name, description, systemPrompt, createdAt, updatedAt
        });
        expect(result.success).toBe(true);
      }
    ));
  });

  it('validates temperature range', () => {
    const tooLow = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      userId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Test',
      temperature: -1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    expect(AssistantSchema.safeParse(tooLow).success).toBe(false);

    const tooHigh = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      userId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Test',
      temperature: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    expect(AssistantSchema.safeParse(tooHigh).success).toBe(false);
  });

  it('applies default values', () => {
    const minimal = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      userId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const result = AssistantSchema.parse(minimal);
    expect(result.model).toBe('gpt-4');
    expect(result.temperature).toBe(0.7);
  });
});
