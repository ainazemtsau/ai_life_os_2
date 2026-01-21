export const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant.`;

export function buildSystemPrompt(
  base: string,
  context?: string | null
): string {
  if (!context || context.trim() === '') {
    return base;
  }
  return `${base}\n\nAdditional context:\n${context}`;
}
