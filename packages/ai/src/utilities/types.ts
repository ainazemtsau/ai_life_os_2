import type { z } from 'zod';

export interface TierConfig {
  tier: 1 | 2 | 3;
  model: string;
  maxRetries: number;
  timeoutMs: number;
}

export interface UtilityConfig<TInput = unknown, TOutput = unknown> {
  name: string;
  tier: 1 | 2 | 3;
  prompt: (input: TInput) => string;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>;
  maxRetries?: number;
  timeoutMs?: number;
}

export type UtilityResult<T> =
  | { success: true; data: T; tier: 1 | 2 | 3 }
  | { success: false; error: string; fallback?: T };
