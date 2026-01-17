/**
 * Context Health - Context window health tracking and management
 *
 * Implements ClaudeKit Engineer's context health monitoring formulas:
 * - Health status thresholds (HEALTHY/WARNING/CRITICAL/EMERGENCY)
 * - Auto-compact trigger calculation
 * - Budget allocation with buffer reserve
 * - Context usage tracking (input + output)
 */

/**
 * Health status levels based on context utilization
 */
export type ContextHealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';

/**
 * Context health metrics
 */
export interface ContextHealth {
  status: ContextHealthStatus;
  score: number;           // 0.0-1.0
  utilization: number;     // 0.0-1.0 (percentage as decimal)
  utilizationPercent: number; // 0-100
  totalTokens: number;
  limit: number;
  remaining: number;
  shouldCompact: boolean;  // Auto-compact trigger
  compactThreshold: number;
}

/**
 * Budget allocation configuration
 */
export interface ContextBudget {
  systemPrompt: number;
  toolDefinitions: number;
  retrievedDocs: number;
  messageHistory: number;
  bufferPercent: number;    // 0.0-1.0 (default: 0.15 = 15%)
  totalBudget: number;
  warningThreshold: number; // 70% of budget
  criticalThreshold: number; // 80% of budget
}

/**
 * Default budget values from ClaudeKit Engineer
 */
const DEFAULT_BUDGET_CONFIG = {
  systemPrompt: 2000,
  toolDefinitions: 1500,
  retrievedDocs: 3000,
  messageHistory: 5000,
  bufferPercent: 0.15, // 15% buffer
};

/**
 * Calculate context budget allocation
 *
 * Formula from ClaudeKit:
 * - subtotal = system + tools + docs + history
 * - buffer = subtotal × buffer_pct
 * - total = subtotal + buffer
 * - warning = total × 0.70
 * - critical = total × 0.80
 */
export function calculateContextBudget(config = DEFAULT_BUDGET_CONFIG): ContextBudget {
  const subtotal =
    config.systemPrompt +
    config.toolDefinitions +
    config.retrievedDocs +
    config.messageHistory;

  const buffer = Math.floor(subtotal * config.bufferPercent);
  const totalBudget = subtotal + buffer;

  return {
    ...config,
    totalBudget,
    warningThreshold: Math.floor(totalBudget * 0.70),
    criticalThreshold: Math.floor(totalBudget * 0.80),
  };
}

/**
 * Calculate auto-compact threshold
 *
 * Formula from ClaudeKit:
 * - For window >= 1M: threshold = size × 0.33 (33%)
 * - For window < 1M:  threshold = size × 0.775 (77.5%)
 *
 * Example: 200K window → 155K threshold
 */
export function calculateCompactThreshold(contextWindowSize: number): number {
  if (contextWindowSize >= 1_000_000) {
    return Math.floor(contextWindowSize * 0.33);
  }
  return Math.floor(contextWindowSize * 0.775);
}

/**
 * Determine health status based on utilization
 *
 * Thresholds from ClaudeKit:
 * - < 50%: HEALTHY (score 1.0)
 * - 50-70%: WARNING (score 0.8)
 * - 70-85%: CRITICAL (score 0.5)
 * - >= 85%: EMERGENCY (score 0.2)
 */
export function getHealthStatus(utilization: number): { status: ContextHealthStatus; score: number } {
  if (utilization < 0.50) {
    return { status: 'HEALTHY', score: 1.0 };
  } else if (utilization < 0.70) {
    return { status: 'WARNING', score: 0.8 };
  } else if (utilization < 0.85) {
    return { status: 'CRITICAL', score: 0.5 };
  } else {
    return { status: 'EMERGENCY', score: 0.2 };
  }
}

/**
 * Calculate comprehensive context health metrics
 *
 * Context calculation from ClaudeKit:
 * usage = (context_input + context_output) / context_size × 100
 *
 * Note: This differs from prompt caching metrics where:
 * - context_input = input_tokens + cache_read_tokens + cache_creation_tokens
 * - context_output = output_tokens
 */
export function calculateContextHealth(
  inputTokens: number,
  outputTokens: number,
  contextLimit: number
): ContextHealth {
  // Total context = input + output (ClaudeKit formula)
  const totalTokens = inputTokens + outputTokens;

  // Utilization as decimal (0.0-1.0)
  const utilization = totalTokens / contextLimit;
  const utilizationPercent = utilization * 100;

  // Remaining tokens
  const remaining = contextLimit - totalTokens;

  // Health status and score
  const { status, score } = getHealthStatus(utilization);

  // Auto-compact trigger
  const compactThreshold = calculateCompactThreshold(contextLimit);
  const shouldCompact = totalTokens >= compactThreshold;

  return {
    status,
    score,
    utilization,
    utilizationPercent,
    totalTokens,
    limit: contextLimit,
    remaining,
    shouldCompact,
    compactThreshold,
  };
}

/**
 * Format health status for display
 */
export function formatHealthStatus(health: ContextHealth): string {
  const emoji = {
    HEALTHY: '✅',
    WARNING: '⚠️',
    CRITICAL: '🔴',
    EMERGENCY: '🚨',
  }[health.status];

  return `${emoji} ${health.status} (${health.utilizationPercent.toFixed(1)}%)`;
}

/**
 * Get health recommendations based on status
 */
export function getHealthRecommendations(health: ContextHealth): string[] {
  const recommendations: string[] = [];

  if (health.shouldCompact) {
    recommendations.push(
      `Context exceeds compact threshold (${health.compactThreshold.toLocaleString()} tokens). ` +
      `Consider enabling auto-compact or manually compacting context.`
    );
  }

  switch (health.status) {
    case 'EMERGENCY':
      recommendations.push(
        'URGENT: Context window nearly full. Immediate action required.',
        'Recommendation: Compact context, summarize history, or start new session.'
      );
      break;
    case 'CRITICAL':
      recommendations.push(
        'Context usage critical. Plan to compact soon.',
        'Recommendation: Enable auto-compact or prepare to summarize.'
      );
      break;
    case 'WARNING':
      recommendations.push(
        'Context usage elevated. Monitor usage closely.',
        'Recommendation: Consider enabling auto-compact for longer sessions.'
      );
      break;
    case 'HEALTHY':
      // No recommendations for healthy state
      break;
  }

  return recommendations;
}
