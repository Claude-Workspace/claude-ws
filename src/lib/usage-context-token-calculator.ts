/**
 * Usage Context Token Calculator - Compute context window usage from SDK token counts
 *
 * Extracted from usage-tracker.ts. Pure functions that calculate context utilization,
 * baseline tracking, and health metrics from raw SDK usage fields.
 */

import { calculateContextHealth, type ContextHealth } from './context-health';
import { createLogger } from './logger';

const log = createLogger('UsageContextTokenCalculator');

export interface RawTokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface ContextTokenResult {
  contextUsed: number;
  contextPercentage: number;
  baselineContext: number; // only set on first turn (numTurns === 0)
  contextHealth: ContextHealth;
}

/**
 * Calculate context window metrics from a single SDK turn's raw token usage.
 *
 * Anthropic's context window includes ALL of:
 * - input_tokens: new user message
 * - cache_read_input_tokens: cached content (still occupies window)
 * - cache_creation_input_tokens: new cache entries
 * - output_tokens: model response
 *
 * @param usage        Raw token counts from the SDK result message
 * @param contextLimit Current context window size (default 200K)
 * @param isFirstTurn  Whether this is the first turn (to capture baseline)
 */
export function calculateContextTokens(
  usage: RawTokenUsage,
  contextLimit: number,
  isFirstTurn: boolean
): ContextTokenResult {
  const inputTokens = usage.input_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const cacheCreation = usage.cache_creation_input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;

  // Baseline: first-turn cache_read tokens (for reference only)
  let baselineContext = 0;
  if (isFirstTurn && cacheRead > 0) {
    baselineContext = cacheRead;
    log.info(`First turn baseline (cached): ${cacheRead} tokens`);
  }

  // Active context = all tokens in the 200K window
  const contextUsed = inputTokens + cacheRead + cacheCreation + outputTokens;
  const contextPercentage = (contextUsed / contextLimit) * 100;

  const contextHealth = calculateContextHealth(
    inputTokens + cacheRead + cacheCreation, // total input (including cached)
    outputTokens,
    contextLimit
  );

  log.debug({
    contextUsed,
    contextLimit,
    contextPercentage: contextPercentage.toFixed(1),
    healthStatus: contextHealth.status,
    inputTokens,
    cacheRead,
    cacheCreation,
    outputTokens,
    totalInput: inputTokens + cacheRead + cacheCreation,
  }, 'Context updated (includes cache_read)');

  return { contextUsed, contextPercentage, baselineContext, contextHealth };
}
