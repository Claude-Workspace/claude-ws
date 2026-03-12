/**
 * Agent Event Wiring - Provider event listener setup and workflow tracking
 *
 * Extracted from agent-manager.ts. Wires provider events (message, question,
 * complete, error, stderr) to AgentManager events. Also tracks subagent
 * workflow and Bash commands from raw SDK/CLI messages.
 */

import type { ClaudeOutput } from '../types';
import type { BackgroundShellInfo, SDKResultMessage } from '@/lib/sdk-event-adapter';
import { sessionManager } from '@/lib/session-manager';
import { checkpointManager } from '@/lib/checkpoint-manager';
import { usageTracker } from '@/lib/usage-tracker';
import { collectGitStats, gitStatsCache } from '@/lib/git-stats-collector';
import { readOutputFile } from '@/lib/agent-output-handler';
import { trackWorkflowFromMessage } from '@/lib/agent-workflow-message-tracker';
import type { Provider } from '@/lib/providers';

/** Interface for the AgentManager context needed by event wiring */
export interface EventWiringContext {
  getSessionId(attemptId: string): string | undefined;
  setSessionId(attemptId: string, sessionId: string): void;
  deleteAgent(attemptId: string): void;
  emit(event: string, data: unknown): boolean;
  pendingBashCommands: Map<string, { command: string; attemptId: string }>;
}

/**
 * Wire provider events to AgentManager events for a specific attempt.
 * Returns a cleanup function that removes all listeners.
 */
export function wireProviderEvents(
  ctx: EventWiringContext,
  provider: Provider,
  attemptId: string,
  outputFormat?: string,
  projectPath?: string,
): () => void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listeners: Array<{ event: string; fn: (...args: any[]) => void }> = [];

  const cleanup = () => {
    for (const { event, fn } of listeners) {
      provider.removeListener(event, fn);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addListener = (event: string, fn: (...args: any[]) => void) => {
    listeners.push({ event, fn });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider.on(event as any, fn);
  };

  addListener('message', async (data: {
    attemptId: string;
    output: ClaudeOutput;
    sessionId?: string;
    checkpointUuid?: string;
    backgroundShell?: BackgroundShellInfo;
    resultMessage?: SDKResultMessage;
    rawMessage?: unknown;
  }) => {
    if (data.attemptId !== attemptId) return;

    if (data.sessionId) {
      ctx.setSessionId(attemptId, data.sessionId);
      await sessionManager.saveSession(attemptId, data.sessionId);
    }

    if (data.checkpointUuid) {
      checkpointManager.captureCheckpointUuid(attemptId, data.checkpointUuid);
    }

    if (data.rawMessage) {
      trackWorkflowFromMessage(ctx, attemptId, data.rawMessage);
    }

    if (data.resultMessage) {
      usageTracker.trackResult(attemptId, data.resultMessage);
    }

    if (data.backgroundShell) {
      ctx.emit('backgroundShell', { attemptId, shell: data.backgroundShell });
    }

    // Emit adapted message (suppress result if custom output format)
    if (!(data.output.type === 'result' && outputFormat)) {
      if (outputFormat) {
        data.output.outputFormat = outputFormat;
      }
      ctx.emit('json', { attemptId, data: data.output });
    }
  });

  addListener('question', (data: { attemptId: string; toolUseId: string; questions: unknown[] }) => {
    if (data.attemptId !== attemptId) return;
    ctx.emit('question', data);
  });

  addListener('questionResolved', (data: { attemptId: string }) => {
    if (data.attemptId !== attemptId) return;
    ctx.emit('questionResolved', data);
  });

  addListener('complete', async (data: { attemptId: string; sessionId?: string }) => {
    if (data.attemptId !== attemptId) return;

    if (outputFormat) {
      readOutputFile(ctx, attemptId, outputFormat);
    }

    if (projectPath) {
      try {
        const gitStats = await collectGitStats(projectPath);
        if (gitStats) gitStatsCache.set(attemptId, gitStats);
      } catch { /* continue */ }
    }

    ctx.deleteAgent(attemptId);
    ctx.emit('exit', { attemptId, code: 0 });
    cleanup();
  });

  addListener('error', (data: { attemptId: string; error: string; errorName: string; isPromptTooLong?: boolean }) => {
    if (data.attemptId !== attemptId) return;

    ctx.emit('stderr', { attemptId, content: `${data.errorName}: ${data.error}` });

    if (data.isPromptTooLong) {
      ctx.emit('promptTooLong', { attemptId });
    }

    ctx.deleteAgent(attemptId);
    ctx.emit('exit', { attemptId, code: 1 });
    cleanup();
  });

  addListener('stderr', (data: { attemptId: string; content: string }) => {
    if (data.attemptId !== attemptId) return;
    ctx.emit('stderr', data);
  });

  return cleanup;
}

