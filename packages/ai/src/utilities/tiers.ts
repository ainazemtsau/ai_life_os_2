import type { TierConfig } from './types';

export const TIERS: Record<1 | 2 | 3, string> = {
  1: 'gpt-5',
  2: 'gpt-5-mini',
  3: 'gpt-5-nano',
};

export const DEFAULT_UTILITY_TIER: 1 | 2 | 3 = 2;

export const DEFAULT_TIER_CONFIG: Omit<TierConfig, 'tier' | 'model'> = {
  maxRetries: 3,
  timeoutMs: 5000,
};
