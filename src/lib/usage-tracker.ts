/**
 * Usage Tracker - Collect and aggregate usage statistics from SDK messages
 *
 * Tracks token usage, costs, and plan limits in-memory for status line display.
 * Context token calculation extracted to: usage-context-token-calculator.ts
 */

import { EventEmitter } from 'events';
import type { SDKResultMessage } from './sdk-event-adapter';
import type { ContextHealth } from './context-health';
import { calculateContextTokens } from './usage-context-token-calculator';

import { createLogger } from './logger';

const log = createLogger('UsageTracker');

/**
 * Aggregated usage statistics for a session
 */
export interface UsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalTokens: number;
  totalCostUSD: number;
  numTurns: number;
  durationMs: number;
  durationApiMs: number;

  // Context usage tracking (full context window)
  contextUsed: number;
  contextLimit: number;
  contextPercentage: number;
  baselineContext: number;

  // Context health metrics (ClaudeKit formulas)
  contextHealth?: ContextHealth;

  // Per-model breakdown
  modelUsage: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    costUSD: number;
    contextWindow: number;
  }>;

  // Session metadata
  sessionId?: string;
  startedAt: number;
  lastUpdatedAt: number;
}

/**
 * Account info from Claude Code (from accountInfo() API)
 */
export interface AccountInfo {
  email?: string;
  organization?: string;
  subscriptionType?: string;
  tokenSource?: string;
  apiKeySource?: string;
}

/**
 * Plan limits - retrieved once and cached
 */
export interface PlanLimits {
  maxTokensPerWindow?: number;
  windowDurationMs?: number;
}

interface UsageTrackerEvents {
  'usage-update': (data: { attemptId: string; usage: UsageStats }) => void;
}

/**
 * UsageTracker - Singleton to track usage statistics
 */
class UsageTracker extends EventEmitter {
  private sessions = new Map<string, UsageStats>();
  private accountInfo?: AccountInfo;

  constructor() {
    super();
  }

  /** Initialize or get usage stats for an attempt */
  initSession(attemptId: string): UsageStats {
    if (!this.sessions.has(attemptId)) {
      const stats: UsageStats = {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheCreationTokens: 0,
        totalCacheReadTokens: 0,
        totalTokens: 0,
        totalCostUSD: 0,
        numTurns: 0,
        durationMs: 0,
        durationApiMs: 0,
        contextUsed: 0,
        contextLimit: 200000,
        contextPercentage: 0,
        baselineContext: 0,
        modelUsage: {},
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };
      this.sessions.set(attemptId, stats);
    }
    return this.sessions.get(attemptId)!;
  }

  /** Update usage stats from SDKResultMessage */
  trackResult(attemptId: string, result: SDKResultMessage): void {
    const stats = this.initSession(attemptId);

    if ('session_id' in result) {
      stats.sessionId = result.session_id;
    }

    if ('usage' in result) {
      const usage = result.usage as {
        input_tokens: number;
        output_tokens: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
      };

      stats.totalInputTokens += usage.input_tokens;
      stats.totalOutputTokens += usage.output_tokens;
      stats.totalCacheCreationTokens += usage.cache_creation_input_tokens || 0;
      stats.totalCacheReadTokens += usage.cache_read_input_tokens || 0;
      stats.totalTokens = stats.totalInputTokens + stats.totalOutputTokens;

      const { contextUsed, contextPercentage, baselineContext, contextHealth } =
        calculateContextTokens(usage, stats.contextLimit, stats.numTurns === 0);

      stats.contextUsed = contextUsed;
      stats.contextPercentage = contextPercentage;
      if (baselineContext > 0) stats.baselineContext = baselineContext;
      stats.contextHealth = contextHealth;
    }

    if ('total_cost_usd' in result) stats.totalCostUSD += result.total_cost_usd as number;
    if ('num_turns' in result) stats.numTurns += result.num_turns || 0;
    if ('duration_ms' in result) stats.durationMs += result.duration_ms || 0;
    if ('duration_api_ms' in result) stats.durationApiMs += (result as any).duration_api_ms || 0;

    // Merge per-model usage (only in success variant)
    if (result.subtype === 'success' && 'modelUsage' in result && result.modelUsage) {
      for (const [modelName, modelStats] of Object.entries(result.modelUsage)) {
        if (!stats.modelUsage[modelName]) {
          stats.modelUsage[modelName] = {
            inputTokens: 0,
            outputTokens: 0,
            cacheReadInputTokens: 0,
            cacheCreationInputTokens: 0,
            costUSD: 0,
            contextWindow: (modelStats as any).contextWindow || 200000,
          };
        }
        const existing = stats.modelUsage[modelName];
        const ms = modelStats as any;
        existing.inputTokens += ms.inputTokens || 0;
        existing.outputTokens += ms.outputTokens || 0;
        existing.cacheReadInputTokens += ms.cacheReadInputTokens || 0;
        existing.cacheCreationInputTokens += ms.cacheCreationInputTokens || 0;
        existing.costUSD += ms.costUSD || 0;

        // Update context limit from model context window if available
        if (ms.contextWindow && ms.contextWindow > 0) {
          stats.contextLimit = ms.contextWindow;
        }
      }
    }

    stats.lastUpdatedAt = Date.now();
    this.emit('usage-update', { attemptId, usage: stats });
  }

  /** Get current usage stats for an attempt */
  getUsage(attemptId: string): UsageStats | undefined {
    return this.sessions.get(attemptId);
  }

  /** Clear usage stats for an attempt */
  clearSession(attemptId: string): void {
    this.sessions.delete(attemptId);
  }

  /** Get all active sessions */
  getAllSessions(): Map<string, UsageStats> {
    return this.sessions;
  }

  /** Set account info (from accountInfo() API call) */
  setAccountInfo(info: AccountInfo): void {
    this.accountInfo = info;
  }

  /** Get cached account info */
  getAccountInfo(): AccountInfo | undefined {
    return this.accountInfo;
  }

  override on<K extends keyof UsageTrackerEvents>(
    event: K,
    listener: UsageTrackerEvents[K]
  ): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof UsageTrackerEvents>(
    event: K,
    ...args: Parameters<UsageTrackerEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}

// Export singleton instance
export const usageTracker = new UsageTracker();
