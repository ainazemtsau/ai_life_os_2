// Handles both old string format (backward compat) and new SSEEvent format
export function createTextStream(
  asyncGenerator: AsyncGenerator<unknown, void, unknown>
) {
  return new ReadableStream({
    async start(controller) {
      for await (const event of asyncGenerator) {
        if (typeof event === 'string') {
          // Legacy string format
          controller.enqueue(new TextEncoder().encode(event));
        } else if (typeof event === 'object' && event !== null && 'type' in event) {
          // New SSEEvent format - extract text from chunk events
          const e = event as { type: string; content?: string };
          if (e.type === 'chunk' && e.content) {
            controller.enqueue(new TextEncoder().encode(e.content));
          }
          // Ignore 'meta' and 'complete' events for plain text stream
        }
      }
      controller.close();
    },
  });
}

// Creates SSE stream with all event types (meta, chunk, complete)
export function createSSEStream(
  asyncGenerator: AsyncGenerator<unknown, void, unknown>
) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for await (const event of asyncGenerator) {
        if (typeof event === 'object' && event !== null) {
          // SSE format: data: {JSON}\n\n
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        }
      }
      controller.close();
    },
  });
}
