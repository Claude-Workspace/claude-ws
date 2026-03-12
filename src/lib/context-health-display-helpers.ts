/**
 * Context Health Display Helpers - Format health status and generate recommendations for display
 *
 * Extracted from context-health.ts. Provides human-readable formatting and
 * actionable recommendations based on ContextHealth metrics.
 */

import type { ContextHealth } from './context-health';

/**
 * Format health status as a short human-readable string with status emoji.
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
 * Get actionable recommendations based on health status.
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
