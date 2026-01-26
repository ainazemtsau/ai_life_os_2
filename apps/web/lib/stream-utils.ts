export function createTextStream(
  asyncGenerator: AsyncGenerator<string, void, unknown>
) {
  return new ReadableStream({
    async start(controller) {
      for await (const chunk of asyncGenerator) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });
}
