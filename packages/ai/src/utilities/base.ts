import { generateText } from 'ai';
import { getModel } from '../config';
import { withRetry } from '../utils/retry';
import { TIERS, DEFAULT_TIER_CONFIG } from './tiers';
import type { UtilityConfig, UtilityResult } from './types';

export function createUtility<TInput, TOutput>(
  config: UtilityConfig<TInput, TOutput>
) {
  const maxRetries = config.maxRetries ?? DEFAULT_TIER_CONFIG.maxRetries;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIER_CONFIG.timeoutMs;

  async function executeWithTier(
    input: TInput,
    tier: 1 | 2 | 3
  ): Promise<UtilityResult<TOutput>> {
    const modelId = TIERS[tier];
    if (!modelId) {
      return {
        success: false,
        error: `Invalid tier: ${tier}`,
      };
    }

    const prompt = config.prompt(input);

    try {
      const result = await withRetry(
        async () => {
          const model = getModel(modelId);
          const { text } = await generateText({
            model,
            prompt,
            maxTokens: 100,
            abortSignal: AbortSignal.timeout(timeoutMs),
          });

          const parsed = config.outputSchema.parse(JSON.parse(text));
          return parsed;
        },
        maxRetries,
        [1000, 2000, 4000]
      );

      return {
        success: true,
        data: result,
        tier,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Tier ${tier} (${modelId}) failed: ${errorMessage}`,
      };
    }
  }

  return {
    name: config.name,
    async execute(input: TInput): Promise<UtilityResult<TOutput>> {
      const validatedInput = config.inputSchema.parse(input);

      const tier = config.tier;
      let result = await executeWithTier(validatedInput, tier);
      if (result.success) return result;

      // Fallback upgrades quality (lower tier number = more expensive/reliable model)
      // tier → (tier-1) → 1 upgrades to better models for improved reliability on failures
      // Note: Rate limit mitigation requires external circuit breaker, not tier downgrade
      // Tier 1 rate limits require caller retry or different tier selection
      if (tier > 1) {
        result = await executeWithTier(validatedInput, (tier - 1) as 1 | 2);
        if (result.success) return result;
      }

      if (tier > 2) {
        result = await executeWithTier(validatedInput, 1);
      }

      return result;
    },
  };
}
