export interface Message {
  role: string;
  content: string;
}

// Simple token estimation: ~4 chars per token (conservative estimate)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function truncateContext(
  messages: Message[],
  systemPrompt: string,
  maxTokens: number,
  minMessages: number = 4
): Message[] {
  const systemTokens = estimateTokens(systemPrompt);

  let totalTokens = systemTokens;
  const messageCosts: number[] = [];

  for (const msg of messages) {
    const tokens = estimateTokens(msg.content);
    messageCosts.push(tokens);
    totalTokens += tokens;
  }

  if (totalTokens <= maxTokens) {
    return messages;
  }

  const keepLast = Math.min(minMessages, messages.length);
  const mustKeep = messages.slice(-keepLast);
  const candidates = messages.slice(0, -keepLast);

  // Accumulate from oldest (index 0) until budget exhausted.
  // keepCount naturally becomes the slice endpoint for messages that fit.
  // :DECISION: Forward accumulation required; backward counting with removeCount
  // causes off-by-one errors (tracks messages that DON'T fit, leading to wrong
  // slice boundaries).
  let currentTokens = systemTokens + messageCosts.slice(-keepLast).reduce((a, b) => a + b, 0);
  let keepCount = 0;

  for (let i = 0; i < candidates.length; i++) {
    if (currentTokens + messageCosts[i] <= maxTokens) {
      currentTokens += messageCosts[i];
      keepCount++;
    } else {
      break;
    }
  }

  return candidates.slice(0, keepCount).concat(mustKeep);
}
