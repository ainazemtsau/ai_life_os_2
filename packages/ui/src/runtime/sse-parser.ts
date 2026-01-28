import type { SSEEvent } from '@ai-life-os/contracts';
import { SSEEventSchema } from '@ai-life-os/contracts';

/**
 * Result of parsing an SSE stream
 */
export interface SSEParseResult {
  event: SSEEvent;
  raw: unknown;
}

/**
 * Parses SSE data line and validates against the event schema.
 * Returns null if parsing fails or validation fails.
 */
export function parseSSELine(line: string): SSEParseResult | null {
  if (!line.startsWith('data: ')) {
    return null;
  }

  const data = line.slice(6);
  try {
    const parsed = JSON.parse(data);
    const validated = SSEEventSchema.safeParse(parsed);

    if (!validated.success) {
      return null;
    }

    return {
      event: validated.data,
      raw: parsed,
    };
  } catch {
    return null;
  }
}

/**
 * Processes an SSE buffer and yields parsed events.
 * Handles buffer accumulation for partial messages.
 */
export function* processSSEBuffer(
  chunk: string,
  existingBuffer: string
): Generator<{ event: SSEEvent; remainingBuffer: string }> {
  const buffer = existingBuffer + chunk;
  const lines = buffer.split('\n\n');
  const remainingBuffer = lines.pop() || '';

  for (const line of lines) {
    const result = parseSSELine(line);
    if (result) {
      yield { event: result.event, remainingBuffer };
    }
  }
}

/**
 * Creates an async generator that reads SSE events from a ReadableStream.
 */
export async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<SSEEvent> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const result = parseSSELine(line);
      if (result) {
        yield result.event;
      }
    }
  }
}
