/**
 * Claude SDK Provider - Uses @anthropic-ai/claude-agent-sdk query()
 *
 * Extracted from the original agent-manager.ts.
 * Handles MCP config loading, canUseTool callback with AskUserQuestion,
 * Bash BGPID fix interception, model alias mapping, and abort management.
 */

import { EventEmitter } from 'events';
import { existsSync, readFileSync } from 'fs';
import { join, normalize } from 'path';
import { homedir } from 'os';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { adaptSDKMessage, isValidSDKMessage, type SDKResultMessage } from '../sdk-event-adapter';
import { checkpointManager } from '../checkpoint-manager';
import { modelIdToDisplayName } from '../models';
import { createLogger } from '../logger';
import type { Provider, ProviderSession, ProviderStartOptions, ProviderEventData, ProviderId } from './types';

const log = createLogger('SDKProvider');

// --- MCP Configuration ---

interface MCPStdioServerConfig {
  type?: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface MCPHttpServerConfig {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}

interface MCPSSEServerConfig {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
}

type MCPServerConfig = MCPStdioServerConfig | MCPHttpServerConfig | MCPSSEServerConfig;

interface MCPConfig {
  mcpServers?: Record<string, MCPServerConfig>;
}

function loadSingleMCPConfig(configPath: string): Record<string, MCPServerConfig> | null {
  if (!existsSync(configPath)) return null;

  try {
    const content = readFileSync(configPath, 'utf-8');
    let config = JSON.parse(content) as MCPConfig;

    if (!config.mcpServers) {
      const keys = Object.keys(config);
      const looksLikeServers = keys.some(key => {
        const val = (config as Record<string, unknown>)[key];
        return val && typeof val === 'object' && ('command' in val || 'url' in val || 'type' in val);
      });
      if (looksLikeServers) {
        config = { mcpServers: config as unknown as Record<string, MCPServerConfig> };
      }
    }

    return config.mcpServers || null;
  } catch (error) {
    log.warn({ err: error, path: configPath }, 'Failed to parse config file');
    return null;
  }
}

function interpolateEnvVars(servers: Record<string, MCPServerConfig>): void {
  for (const [, serverConfig] of Object.entries(servers)) {
    if ('env' in serverConfig && serverConfig.env) {
      for (const [key, value] of Object.entries(serverConfig.env)) {
        if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
          const envVar = value.slice(2, -1);
          serverConfig.env[key] = process.env[envVar] || '';
        }
      }
    }
    if ('headers' in serverConfig && serverConfig.headers) {
      for (const [key, value] of Object.entries(serverConfig.headers)) {
        if (typeof value === 'string' && value.includes('${')) {
          serverConfig.headers[key] = value.replace(/\$\{([^}]+)\}/g, (_, envVar) => process.env[envVar] || '');
        }
      }
    }
  }
}

function loadMCPConfig(projectPath: string): MCPConfig | null {
  const claudeConfigPath = join(homedir(), '.claude.json');
  const projectConfigPath = join(projectPath, '.mcp.json');
  let userServers: Record<string, MCPServerConfig> | null = null;

  if (existsSync(claudeConfigPath)) {
    try {
      const content = readFileSync(claudeConfigPath, 'utf-8');
      const config = JSON.parse(content);

      if (config.mcpServers && typeof config.mcpServers === 'object' && Object.keys(config.mcpServers).length > 0) {
        userServers = config.mcpServers as Record<string, MCPServerConfig>;
        log.info({ servers: Object.keys(userServers || {}), path: claudeConfigPath }, 'Loaded global MCP config');
      }

      if (config.projects && config.projects[projectPath]?.mcpServers) {
        const projectServers = config.projects[projectPath].mcpServers as Record<string, MCPServerConfig>;
        if (Object.keys(projectServers).length > 0) {
          userServers = { ...(userServers || {}), ...projectServers };
          log.info({ servers: Object.keys(projectServers), projectPath }, 'Loaded CLI project MCP config');
        }
      }
    } catch (error) {
      log.warn({ err: error, path: claudeConfigPath }, 'Failed to parse config file');
    }
  }

  const projectServers = loadSingleMCPConfig(projectConfigPath);
  if (projectServers) {
    log.info({ servers: Object.keys(projectServers), path: projectConfigPath }, 'Loaded project MCP config');
  }

  const mergedServers: Record<string, MCPServerConfig> = {
    ...(userServers || {}),
    ...(projectServers || {}),
  };

  if (Object.keys(mergedServers).length === 0) {
    log.info('No MCP servers found in user or project config');
    return null;
  }

  interpolateEnvVars(mergedServers);
  log.info({ servers: Object.keys(mergedServers) }, 'Merged MCP servers');
  return { mcpServers: mergedServers };
}

function getMCPToolWildcards(mcpServers: Record<string, MCPServerConfig>): string[] {
  return Object.keys(mcpServers).map(serverName => `mcp__${serverName}__*`);
}

// --- Model alias mapping ---

const MODEL_ALIAS_MAP: Record<string, string> = {
  'claude-opus-4-6': 'opus',
  'claude-sonnet-4-5-20250929': 'sonnet',
  'claude-haiku-4-5-20251001': 'haiku',
  'claude-3-5-sonnet-20241022': 'sonnet',
};

// --- Server command detection ---

const SERVER_PATTERNS = [
  /npm\s+run\s+(dev|start|serve)/i,
  /yarn\s+(dev|start|serve)/i,
  /pnpm\s+(dev|start|serve)/i,
  /npx\s+(directus|strapi|next|vite|nuxt)/i,
  /nohup\s+/i,
];

function isServerCommand(command: string): boolean {
  return SERVER_PATTERNS.some(p => p.test(command));
}

// --- Pending question types ---

interface PendingQuestion {
  toolUseId: string;
  resolve: (answer: QuestionAnswer | null) => void;
}

interface QuestionAnswer {
  questions: unknown[];
  answers: Record<string, string>;
}

// --- SDK Session ---

class SDKSession implements ProviderSession {
  readonly providerId: ProviderId = 'claude-sdk';
  sessionId: string | undefined;
  outputFormat?: string;
  queryRef?: Query;
  controller: AbortController;

  constructor(
    readonly attemptId: string,
    controller: AbortController,
    outputFormat?: string,
  ) {
    this.controller = controller;
    this.outputFormat = outputFormat;
  }

  cancel(): void {
    if (this.queryRef) {
      try {
        this.queryRef.close();
      } catch {
        this.controller.abort();
      }
    } else {
      this.controller.abort();
    }
  }
}

// --- Provider ---

export class ClaudeSDKProvider extends EventEmitter implements Provider {
  readonly id: ProviderId = 'claude-sdk';

  private sessions = new Map<string, SDKSession>();
  private pendingQuestions = new Map<string, PendingQuestion>();
  private pendingQuestionData = new Map<string, { toolUseId: string; questions: unknown[]; timestamp: number }>();
  private pendingBashCommands = new Map<string, { command: string; attemptId: string }>();

  resolveModel(displayModelId: string): string {
    return MODEL_ALIAS_MAP[displayModelId] || displayModelId;
  }

  async start(options: ProviderStartOptions): Promise<ProviderSession> {
    const { attemptId, projectPath, prompt, sessionOptions, maxTurns, model, systemPromptAppend, outputFormat } = options;

    const controller = new AbortController();
    const session = new SDKSession(attemptId, controller, outputFormat);
    this.sessions.set(attemptId, session);

    // Run query in background (don't await — events are emitted as they arrive)
    this.runQuery(session, projectPath, prompt, sessionOptions, maxTurns, model, systemPromptAppend);

    return session;
  }

  private async runQuery(
    session: SDKSession,
    projectPath: string,
    prompt: string,
    sessionOptions?: { resume?: string; resumeSessionAt?: string },
    maxTurns?: number,
    model?: string,
    systemPromptAppend?: string,
  ): Promise<void> {
    const { attemptId, controller } = session;

    try {
      const mcpConfig = loadMCPConfig(projectPath);
      const mcpToolWildcards = mcpConfig?.mcpServers ? getMCPToolWildcards(mcpConfig.mcpServers) : [];

      // Resolve Windows claude.exe path
      const resolvedClaudePath = (() => {
        if (process.platform !== 'win32') return undefined;
        const envPath = process.env.CLAUDE_PATH;
        if (envPath && existsSync(normalize(envPath))) return normalize(envPath);
        const home = process.env.USERPROFILE || process.env.HOME || '';
        const candidates = [
          join(home, '.local', 'bin', 'claude.exe'),
          join(home, 'AppData', 'Local', 'Programs', 'claude', 'claude.exe'),
        ];
        for (const c of candidates) {
          if (existsSync(c)) return c;
        }
        return undefined;
      })();

      const effectiveModel = model ? this.resolveModel(model) : 'opus';

      const checkpointOptions = checkpointManager.getCheckpointingOptions();

      const queryOptions = {
        cwd: projectPath,
        model: effectiveModel,
        permissionMode: 'bypassPermissions' as const,
        settingSources: ['user', 'project'] as ('user' | 'project')[],
        ...(mcpConfig?.mcpServers ? { mcpServers: mcpConfig.mcpServers } : {}),
        allowedTools: [
          'Skill', 'Task',
          'Read', 'Write', 'Edit', 'NotebookEdit',
          'Bash', 'Grep', 'Glob',
          'WebFetch', 'WebSearch',
          'TodoWrite', 'AskUserQuestion',
          ...mcpToolWildcards,
        ],
        ...(sessionOptions?.resume ? { resume: sessionOptions.resume } : {}),
        ...(sessionOptions?.resumeSessionAt ? { resumeSessionAt: sessionOptions.resumeSessionAt } : {}),
        ...checkpointOptions,
        ...(maxTurns ? { maxTurns } : {}),
        abortController: controller,
        canUseTool: async (toolName: string, input: Record<string, unknown>) => {
          log.debug({ toolName, attemptId }, 'canUseTool called');

          if (toolName === 'AskUserQuestion') {
            if (this.pendingQuestions.has(attemptId)) {
              return { behavior: 'deny' as const, message: 'Duplicate question' };
            }

            const toolUseId = `ask-${Date.now()}`;
            const questions = (input.questions as unknown[]) || [];

            this.pendingQuestionData.set(attemptId, { toolUseId, questions, timestamp: Date.now() });
            this.emit('question', { attemptId, toolUseId, questions });

            const answer = await new Promise<QuestionAnswer | null>((resolve) => {
              this.pendingQuestions.set(attemptId, { toolUseId, resolve });
            });

            this.pendingQuestions.delete(attemptId);
            this.pendingQuestionData.delete(attemptId);

            if (!answer || Object.keys(answer.answers).length === 0) {
              return { behavior: 'deny' as const, message: 'User cancelled' };
            }

            return { behavior: 'allow' as const, updatedInput: answer as unknown as Record<string, unknown> };
          }

          // Bash BGPID fix
          if (toolName === 'Bash') {
            const command = input.command as string | undefined;
            if (command && isServerCommand(command) && !command.includes('echo "BGPID:$!"')) {
              if (/>\s*\/tmp\/[^\s]+\.log\s*$/.test(command)) {
                const fixedCommand = command.trim() + ' 2>&1 & echo "BGPID:$!"';
                log.debug({ fixedCommand }, 'Fixed BGPID pattern');
                return { behavior: 'allow' as const, updatedInput: { ...input, command: fixedCommand } };
              }
            }
          }

          return { behavior: 'allow' as const, updatedInput: input };
        },
      };

      // Build a clean env for the subprocess:
      // - Remove proxy ANTHROPIC_BASE_URL (subprocess uses OAuth directly)
      // - Remove CLAUDECODE to prevent nested session detection
      // - Remove CLAUDE_CODE_ENTRYPOINT so SDK sets it to 'sdk-ts'
      const subprocessEnv = { ...process.env };
      delete subprocessEnv.ANTHROPIC_BASE_URL;
      delete subprocessEnv.ANTHROPIC_PROXIED_BASE_URL;
      delete subprocessEnv.CLAUDECODE;
      delete subprocessEnv.CLAUDE_CODE_ENTRYPOINT;

      log.info({
        endpoint: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
        prompt: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
        model: queryOptions.model,
        cwd: queryOptions.cwd,
        resume: queryOptions.resume,
      }, 'SDK Query starting');

      const response = query({
        prompt,
        options: {
          ...queryOptions,
          env: subprocessEnv,
          ...(resolvedClaudePath ? { pathToClaudeCodeExecutable: resolvedClaudePath } : {}),
          systemPrompt: {
            type: 'preset' as const,
            preset: 'claude_code' as const,
            append: systemPromptAppend || '',
          },
          // Capture stderr from the spawned Claude process for debugging
          stderr: (data: string) => { log.error({ stderr: data.slice(0, 500), attemptId }, 'Claude process stderr'); },
        },
      });

      session.queryRef = response;

      for await (const message of response) {
        if (controller.signal.aborted) break;

        try {
          if (!isValidSDKMessage(message)) continue;

          const adapted = adaptSDKMessage(message);

          // Capture session ID
          if (adapted.sessionId) {
            session.sessionId = adapted.sessionId;
          }

          // Emit adapted message with metadata
          this.emit('message', {
            attemptId,
            output: adapted.output,
            sessionId: adapted.sessionId,
            checkpointUuid: adapted.checkpointUuid,
            backgroundShell: adapted.backgroundShell,
            resultMessage: message.type === 'result' ? message as SDKResultMessage : undefined,
            rawMessage: message,
          });
        } catch (messageError) {
          const errorMsg = messageError instanceof Error ? messageError.message : 'Unknown message error';
          log.error({ err: messageError, message: errorMsg }, 'Message processing error');
          if (!errorMsg.includes('Unexpected end of JSON')) {
            this.emit('stderr', { attemptId, content: `Warning: ${errorMsg}` });
          }
        }
      }

      // Completed
      this.cleanupPendingQuestions(attemptId);
      this.sessions.delete(attemptId);
      this.emit('complete', { attemptId, sessionId: session.sessionId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      const wasResuming = !!sessionOptions?.resume;
      const wasAborted = controller.signal.aborted;

      log.error({ err: error, message: errorMessage, attemptId }, 'SDK Error - Query failed');

      // Retry without resume on stale session
      if (wasResuming && !wasAborted) {
        log.warn({ attemptId }, 'Resume failed, retrying without resume');
        this.sessions.set(attemptId, session);
        return this.runQuery(session, projectPath, prompt, undefined, maxTurns, model, systemPromptAppend);
      }

      const isPromptTooLong = errorMessage.toLowerCase().includes('prompt is too long') ||
                              errorMessage.toLowerCase().includes('request too large');

      this.cleanupPendingQuestions(attemptId);
      this.sessions.delete(attemptId);
      this.emit('error', {
        attemptId,
        error: errorMessage,
        errorName,
        isPromptTooLong,
        wasResuming,
      });
    }
  }

  answerQuestion(attemptId: string, toolUseId: string | undefined, questions: unknown[], answers: Record<string, string>): boolean {
    const pending = this.pendingQuestions.get(attemptId);
    if (!pending) return false;

    if (toolUseId && pending.toolUseId !== toolUseId) {
      log.warn({ attemptId, expected: pending.toolUseId, received: toolUseId }, 'Rejecting stale answer');
      return false;
    }

    pending.resolve({ questions, answers });
    this.pendingQuestions.delete(attemptId);
    this.pendingQuestionData.delete(attemptId);
    this.emit('questionResolved', { attemptId });
    return true;
  }

  cancelQuestion(attemptId: string): boolean {
    const pending = this.pendingQuestions.get(attemptId);
    if (!pending) return false;

    pending.resolve(null);
    this.pendingQuestions.delete(attemptId);
    this.pendingQuestionData.delete(attemptId);
    this.emit('questionResolved', { attemptId });
    return true;
  }

  hasPendingQuestion(attemptId: string): boolean {
    return this.pendingQuestions.has(attemptId);
  }

  getPendingQuestionData(attemptId: string): { toolUseId: string; questions: unknown[]; timestamp: number } | null {
    return this.pendingQuestionData.get(attemptId) || null;
  }

  cancelSession(attemptId: string): boolean {
    const session = this.sessions.get(attemptId);
    if (!session) return false;

    this.cleanupPendingQuestions(attemptId);
    session.cancel();
    this.sessions.delete(attemptId);
    return true;
  }

  private cleanupPendingQuestions(attemptId: string): void {
    const pending = this.pendingQuestions.get(attemptId);
    if (pending) {
      pending.resolve(null);
      this.pendingQuestions.delete(attemptId);
      this.pendingQuestionData.delete(attemptId);
    }
  }

  // Type-safe event emitter overrides
  override on<K extends keyof ProviderEventData>(event: K, listener: (data: ProviderEventData[K]) => void): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  override emit<K extends keyof ProviderEventData>(event: K, data: ProviderEventData[K]): boolean {
    return super.emit(event, data);
  }
}
