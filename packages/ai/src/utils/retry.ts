export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 5,
  delays: number[] = [2000, 4000, 8000, 16000, 32000]
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts - 1) {
        throw lastError;
      }

      const delay = delays[attempt] ?? delays[delays.length - 1];
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
