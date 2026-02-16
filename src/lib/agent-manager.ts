/**
 * Agent Manager - Claude Agent SDK integration for task execution
 *
 * Replaces ProcessManager with SDK-native implementation.
 * Provides streaming output, file checkpointing, and session management.
 */

// Ensure file checkpointing is always enabled
process.env.CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING = '1';

// Enable SDK task system (opt-in feature since v0.2.19)
process.env.CLAUDE_CODE_ENABLE_TASKS = 'true';

import { EventEmitter } from 'events';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import type { ClaudeOutput } from '../types';
import { adaptSDKMessage, isValidSDKMessage, type BackgroundShellInfo, type SDKResultMessage } from './sdk-event-adapter';
import { sessionManager } from './session-manager';
import { checkpointManager } from './checkpoint-manager';
import { usageTracker } from './usage-tracker';
import { workflowTracker } from './workflow-tracker';
import { collectGitStats, gitStatsCache } from './git-stats-collector';
import { getSystemPrompt } from './system-prompt';
import { modelIdToDisplayName } from './models';
import { createLogger } from './logger';

const log = createLogger('AgentManager');

// MCP Server configuration types matching SDK's McpServerConfig union
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

/**
 * Load a single .mcp.json file and parse it
 */
function loadSingleMCPConfig(configPath: string): Record<string, MCPServerConfig> | null {
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    let config = JSON.parse(content) as MCPConfig;

    // Support both formats:
    // 1. { "mcpServers": { "name": {...} } }  - standard format
    // 2. { "name": {...} }                    - flat format (servers at root)
    if (!config.mcpServers) {
      const keys = Object.keys(config);
      const looksLikeServers = keys.some(key => {
        const val = (config as Record<string, unknown>)[key];
        return val && typeof val === 'object' && (
          'command' in val || 'url' in val || 'type' in val
        );
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

/**
 * Interpolate environment variables in MCP server config
 */
function interpolateEnvVars(servers: Record<string, MCPServerConfig>): void {
  for (const [, serverConfig] of Object.entries(servers)) {
    // Interpolate env vars for stdio servers
    if ('env' in serverConfig && serverConfig.env) {
      for (const [key, value] of Object.entries(serverConfig.env)) {
        if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
          const envVar = value.slice(2, -1);
          serverConfig.env[key] = process.env[envVar] || '';
        }
      }
    }
    // Interpolate env vars for HTTP/SSE headers
    if ('headers' in serverConfig && serverConfig.headers) {
      for (const [key, value] of Object.entries(serverConfig.headers)) {
        if (typeof value === 'string' && value.includes('${')) {
          serverConfig.headers[key] = value.replace(/\$\{([^}]+)\}/g, (_, envVar) => process.env[envVar] || '');
        }
      }
    }
  }
}

/**
 * Load MCP configuration from multiple sources (merged)
 * Priority: project-file > cli-project > cli-global
 *
 * Locations checked (in order):
 * 1. ~/.claude.json → mcpServers (global)
 * 2. ~/.claude.json → projects[projectPath].mcpServers (per-project, CLI style)
 * 3. {projectPath}/.mcp.json (project file)
 */
function loadMCPConfig(projectPath: string): MCPConfig | null {
  const claudeConfigPath = join(homedir(), '.claude.json');
  const projectConfigPath = join(projectPath, '.mcp.json');

  let userServers: Record<string, MCPServerConfig> | null = null;

  // Load from ~/.claude.json (both global and per-project)
  if (existsSync(claudeConfigPath)) {
    try {
      const content = readFileSync(claudeConfigPath, 'utf-8');
      const config = JSON.parse(content);

      // 1. Global mcpServers at root level
      if (config.mcpServers && typeof config.mcpServers === 'object' && Object.keys(config.mcpServers).length > 0) {
        userServers = config.mcpServers as Record<string, MCPServerConfig>;
        log.info({ servers: Object.keys(userServers || {}), path: claudeConfigPath }, 'Loaded global MCP config');
      }

      // 2. Per-project mcpServers (CLI style) - overrides global
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

  // Load project config (overrides user)
  const projectServers = loadSingleMCPConfig(projectConfigPath);
  if (projectServers) {
    log.info({ servers: Object.keys(projectServers), path: projectConfigPath }, 'Loaded project MCP config');
  }

  // Merge: project overrides user
  const mergedServers: Record<string, MCPServerConfig> = {
    ...(userServers || {}),
    ...(projectServers || {}),
  };

  if (Object.keys(mergedServers).length === 0) {
    log.info('No MCP servers found in user or project config');
    return null;
  }

  // Interpolate environment variables
  interpolateEnvVars(mergedServers);

  // Log merged servers
  log.info({ servers: Object.keys(mergedServers) }, 'Merged MCP servers');
  for (const [name, cfg] of Object.entries(mergedServers)) {
    const serverType = cfg.type || 'stdio';
    const endpoint = 'url' in cfg ? cfg.url : ('command' in cfg ? cfg.command : 'unknown');
    log.debug({ name, serverType, endpoint }, 'MCP server config');
  }

  return { mcpServers: mergedServers };
}

/**
 * Generate allowed MCP tools wildcards from server names
 */
function getMCPToolWildcards(mcpServers: Record<string, MCPServerConfig>): string[] {
  return Object.keys(mcpServers).map(serverName => `mcp__${serverName}__*`);
}

// Default model for agent queries
export const DEFAULT_MODEL = 'opus' as const;

interface AgentInstance {
  attemptId: string;
  controller: AbortController;
  queryRef?: Query;  // SDK query reference for graceful close()
  startedAt: number;
  sessionId?: string;
  outputFormat?: string;
}

// Pending question resolver type
interface PendingQuestion {
  toolUseId: string;
  resolve: (answer: QuestionAnswer | null) => void;
}

// Answer format for AskUserQuestion tool
interface QuestionAnswer {
  questions: unknown[];
  answers: Record<string, string>;
}

interface AgentEvents {
  started: (data: { attemptId: string; taskId: string }) => void;
  json: (data: { attemptId: string; data: ClaudeOutput }) => void;
  stderr: (data: { attemptId: string; content: string }) => void;
  exit: (data: { attemptId: string; code: number | null }) => void;
  question: (data: { attemptId: string; toolUseId: string; questions: unknown[] }) => void;
  backgroundShell: (data: { attemptId: string; shell: BackgroundShellInfo }) => void;
  trackedProcess: (data: { attemptId: string; pid: number; command: string; logFile?: string }) => void;
}

export interface AgentStartOptions {
  attemptId: string;
  projectPath: string;
  prompt: string;
  model?: string;  // Model ID (e.g., 'claude-opus-4-5-20251101') - falls back to DEFAULT_MODEL
  sessionOptions?: {
    resume?: string;
    resumeSessionAt?: string;  // Message UUID to resume conversation at
  };
  filePaths?: string[];
  outputFormat?: string;  // File extension: json, html, md, csv, tsv, txt, xml, etc.
  outputSchema?: string;
  maxTurns?: number;  // Max conversation turns before stopping (undefined = unlimited)
}

/**
 * AgentManager - Singleton class to manage Claude Agent SDK queries
 * EventEmitter interface for backward compatibility with Socket.io forwarding
 */
class AgentManager extends EventEmitter {
  private agents = new Map<string, AgentInstance>();
  private pendingQuestions = new Map<string, PendingQuestion>();
  // Queryable question data so reconnecting clients can fetch the current pending question
  private pendingQuestionData = new Map<string, { toolUseId: string; questions: unknown[]; timestamp: number }>();
  // Track Bash tool_use commands to correlate with BGPID results
  private pendingBashCommands = new Map<string, { command: string; attemptId: string }>();

  constructor() {
    super();
    // Cleanup on process exit
    process.on('exit', () => this.cancelAll());
  }

  /**
   * Check if command is a server/dev command that should run in background
   */
  private isServerCommand(command: string): boolean {
    const patterns = [
      /npm\s+run\s+(dev|start|serve)/i,
      /yarn\s+(dev|start|serve)/i,
      /pnpm\s+(dev|start|serve)/i,
      /npx\s+(directus|strapi|next|vite|nuxt)/i,
      /nohup\s+/i,
    ];
    return patterns.some(p => p.test(command));
  }

  /**
   * Start a new Claude Agent SDK query
   */
  async start(options: AgentStartOptions): Promise<void> {
    const { attemptId, projectPath, prompt, sessionOptions, filePaths, outputFormat, outputSchema, maxTurns, model } = options;

    if (this.agents.has(attemptId)) {
      return;
    }

    // Use DATA_DIR environment variable for output files (writes to ${DATA_DIR}/tmp/{attemptId}.{ext})
    // Falls back to tmp/{attemptId} if DATA_DIR not set
    const dataDir = process.env.DATA_DIR || '.';
    const outputFilePath = `${dataDir}/tmp/${attemptId}`;

    let fullPrompt = prompt;

    // Add file references as @ syntax in prompt
    if (filePaths && filePaths.length > 0) {
      const fileRefs = filePaths.map(fp => `@${fp}`).join(' ');
      fullPrompt = `${fileRefs} ${prompt}`;
    }

    // Add system prompt (BGPID instructions for background servers)
    const systemPrompt = getSystemPrompt({ prompt, projectPath });
    if (systemPrompt) {
      fullPrompt += `\n\n${systemPrompt}`;
    }

    // Add output format instructions to user prompt
    // Works for both new and resumed sessions
    if (outputFormat) {
      const dataDir = process.env.DATA_DIR || process.cwd();
      const outputFilePath = resolve(dataDir, 'tmp', attemptId);

      // Build example based on format
      let example = '';
      switch (outputFormat.toLowerCase()) {
        case 'json':
          example = `Example: Write:\n["Max", "Bella", "Charlie"]\n\nNOT:\n{Max, Bella, Charlie} (unquoted strings - invalid JSON)\nNOT:\n{"file_path":"...", "content":["Max"]} (don't wrap in metadata)`;
          break;
        case 'yaml':
        case 'yml':
          example = `Example: Write:\n- Max\n- Bella\n- Charlie\n\nNOT:\n["Max", "Bella", "Charlie"] (that's JSON, not YAML)`;
          break;
        case 'html':
        case 'htm':
          example = `Example: Write:\n<div class="container">\n  <h1>Results</h1>\n</div>\n\nNOT:\n{"html": "<div>..."} (don't wrap in metadata)`;
          break;
        case 'css':
          example = `Example: Write:\n.container { color: red; }\n\nNOT:\n{"css": ".container {...}"} (don't wrap in metadata)`;
          break;
        case 'js':
          example = `Example: Write:\nconst result = ["Max", "Bella"];\nconsole.log(result);\n\nNOT:\n{"javascript": "const..."} (don't wrap in metadata)`;
          break;
        case 'md':
        case 'markdown':
          example = `Example: Write:\n# Results\n\n- Max\n- Bella\n- Charlie\n\nNOT:\n{"markdown": "# Results"} (don't wrap in metadata)`;
          break;
        case 'csv':
          example = `Example: Write:\nMax,Bella,Charlie\n\nNOT:\n["Max","Bella","Charlie"] (that's JSON, not CSV)`;
          break;
        case 'tsv':
          example = `Example: Write:\nMax\tBella\tCharlie\n\nNOT:\n["Max","Bella","Charlie"] (that's JSON, not TSV)`;
          break;
        case 'txt':
          example = `Example: Write:\nMax\nBella\nCharlie\n\nNOT:\n{"content": "Max\\nBella"} (don't wrap in metadata)`;
          break;
        case 'xml':
          example = `Example: Write:\n<?xml version="1.0"?>\n<root>\n  <item>Max</item>\n</root>\n\nNOT:\n{"xml": "<?xml...>"} (don't wrap in metadata)`;
          break;
        default:
          example = `Example: Write the actual ${outputFormat.toUpperCase()} content directly, not wrapped in any metadata or JSON object.`;
      }

      fullPrompt += `\n\n=== REQUIRED OUTPUT ===\nYou MUST write your WORK RESULTS to a ${outputFormat.toUpperCase()} file at: ${outputFilePath}.${outputFormat}`;
      if (outputSchema) {
        fullPrompt += `\n\nFormat:\n${outputSchema}`;
      }
      fullPrompt += `\n\nCRITICAL INSTRUCTIONS:
1. Use Write tool with PARAMETER 1 (file path) and PARAMETER 2 (your content)
2. DO NOT wrap content in metadata like {"file_path": ..., "content": ...}
3. The file should contain ONLY the actual ${outputFormat.toUpperCase()} data
4. MANDATORY: After writing, you MUST use Read tool to verify the file was written correctly
5. If the file content is invalid, fix it and rewrite

${example}

Your task is INCOMPLETE until:\n1. File exists with valid content\n2. You have Read it back to verify\n========================`;
    }

    // Create abort controller for cancellation
    const controller = new AbortController();

    const instance: AgentInstance = {
      attemptId,
      controller,
      startedAt: Date.now(),
      outputFormat,
    };

    this.agents.set(attemptId, instance);

    // Get checkpointing options
    const checkpointOptions = checkpointManager.getCheckpointingOptions();

    // Start SDK query in background
    this.runQuery(instance, projectPath, fullPrompt, sessionOptions, checkpointOptions, maxTurns, model);
  }

  /**
   * Run SDK query and stream results
   */
  private async runQuery(
    instance: AgentInstance,
    projectPath: string,
    prompt: string,
    sessionOptions?: { resume?: string; resumeSessionAt?: string },
    checkpointOptions?: ReturnType<typeof checkpointManager.getCheckpointingOptions>,
    maxTurns?: number,
    model?: string
  ): Promise<void> {
    const { attemptId, controller } = instance;

    try {
      // Load MCP configuration from project's .mcp.json
      const mcpConfig = loadMCPConfig(projectPath);
      const mcpToolWildcards = mcpConfig?.mcpServers
        ? getMCPToolWildcards(mcpConfig.mcpServers)
        : [];

      // Debug: Log MCP config being passed to SDK
      if (mcpConfig?.mcpServers) {
        log.debug({ mcpServers: mcpConfig.mcpServers, wildcards: mcpToolWildcards }, 'Passing MCP servers to SDK');
      } else {
        log.debug({ path: `${projectPath}/.mcp.json` }, 'No MCP config found');
      }

      // Configure SDK query options
      // resumeSessionAt: resume conversation at specific message UUID (for rewind)
      // Model priority: provided model > DEFAULT_MODEL ('opus')
      const effectiveModel = model || DEFAULT_MODEL;
      const queryOptions = {
        cwd: projectPath,
        model: effectiveModel, // Use provided model or fallback to 'opus'
        permissionMode: 'bypassPermissions' as const,
        // Enable skill loading from filesystem (~/.claude/skills/ and .claude/skills/)
        settingSources: ['user', 'project'] as ('user' | 'project')[],
        // MCP servers configuration (loaded from .mcp.json)
        ...(mcpConfig?.mcpServers ? { mcpServers: mcpConfig.mcpServers } : {}),
        // Enable Skill tool for skill invocation + MCP tool wildcards
        allowedTools: [
          'Skill',           // Required for skill invocation
          'Task',            // Subagent workflows
          'Read', 'Write', 'Edit', 'NotebookEdit',
          'Bash', 'Grep', 'Glob',
          'WebFetch', 'WebSearch',
          'TodoWrite', 'AskUserQuestion',
          ...mcpToolWildcards, // MCP server tool wildcards (e.g., mcp__github__*)
        ],
        ...(sessionOptions?.resume ? { resume: sessionOptions.resume } : {}),
        ...(sessionOptions?.resumeSessionAt ? { resumeSessionAt: sessionOptions.resumeSessionAt } : {}),
        ...checkpointOptions,
        ...(maxTurns ? { maxTurns } : {}),
        abortController: controller,
        // canUseTool callback - pauses streaming when AskUserQuestion is called
        canUseTool: async (toolName: string, input: Record<string, unknown>) => {
          log.debug({ toolName, attemptId }, 'canUseTool called');
          // Handle AskUserQuestion tool - pause and wait for user input
          if (toolName === 'AskUserQuestion') {
            log.debug({ attemptId, input }, 'AskUserQuestion detected');
            // Prevent duplicate questions for same attempt
            if (this.pendingQuestions.has(attemptId)) {
              log.debug({ attemptId }, 'Duplicate question blocked');
              return { behavior: 'deny' as const, message: 'Duplicate question' };
            }

            const toolUseId = `ask-${Date.now()}`;
            const questions = (input.questions as unknown[]) || [];
            log.debug({ attemptId, toolUseId, questionCount: questions.length }, 'Emitting question event');

            // Store queryable question data (so reconnecting clients can fetch it)
            this.pendingQuestionData.set(attemptId, { toolUseId, questions, timestamp: Date.now() });

            // Emit question event to frontend (streaming is paused here)
            this.emit('question', { attemptId, toolUseId, questions });

            // Wait for user answer (no timeout - user can take as long as needed)
            const answer = await new Promise<QuestionAnswer | null>((resolve) => {
              this.pendingQuestions.set(attemptId, { toolUseId, resolve });
            });

            // Clean up pending question
            this.pendingQuestions.delete(attemptId);
            this.pendingQuestionData.delete(attemptId);

            // Check if cancellation (null/empty answers)
            if (!answer || Object.keys(answer.answers).length === 0) {
              return { behavior: 'deny' as const, message: 'User cancelled' };
            }

            // Return allow with user's answers (cast to Record<string, unknown> for SDK)
            return {
              behavior: 'allow' as const,
              updatedInput: answer as unknown as Record<string, unknown>,
            };
          }

          // Intercept Bash commands to fix incomplete BGPID patterns
          if (toolName === 'Bash') {
            const command = input.command as string | undefined;
            if (command && this.isServerCommand(command) && !command.includes('echo "BGPID:$!"')) {
              // Fix incomplete nohup pattern - add missing 2>&1 & echo "BGPID:$!"
              let fixedCommand = command;
              // Pattern: ends with "> /tmp/xxx.log" or "> /tmp/xxx.log " without the full suffix
              if (/>\s*\/tmp\/[^\s]+\.log\s*$/.test(command)) {
                fixedCommand = command.trim() + ' 2>&1 & echo "BGPID:$!"';
                log.debug({ fixedCommand }, 'Fixed BGPID pattern');
                return { behavior: 'allow' as const, updatedInput: { ...input, command: fixedCommand } };
              }
            }
          }

          // Auto-allow all other tools (bypassPermissions mode)
          return { behavior: 'allow' as const, updatedInput: input };
        },
      };

      // Log payload and endpoint before sending to SDK
      log.info({
        endpoint: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
        prompt: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
        model: queryOptions.model,
        cwd: queryOptions.cwd,
        permissionMode: queryOptions.permissionMode,
        allowedTools: queryOptions.allowedTools?.length || 0,
        resume: queryOptions.resume,
        resumeSessionAt: sessionOptions?.resumeSessionAt,
        maxTurns: queryOptions.maxTurns,
      }, 'SDK Query starting');

      // Append model identity to the CLI's default system prompt.
      // SDK query() with no systemPrompt defaults to "" which overrides the CLI's built-in
      // system prompt entirely. Using preset 'claude_code' keeps the default (env info, tool
      // instructions, CLAUDE.md, etc.) and appends our model identity.
      const modelDisplayName = modelIdToDisplayName(effectiveModel);
      const modelIdentity = modelDisplayName !== effectiveModel
        ? `You are powered by the model named ${modelDisplayName}. The exact model ID is ${effectiveModel}.`
        : `You are powered by the model ${effectiveModel}.`;

      const response = query({
        prompt,
        options: {
          ...queryOptions,
          systemPrompt: { type: 'preset' as const, preset: 'claude_code' as const, append: modelIdentity },
        },
      });
      log.info({ attemptId }, 'Query stream started, iterating messages...');

      // Store query reference for graceful close() on cancel
      instance.queryRef = response;

      // Stream SDK messages with per-message error handling
      // The SDK's internal partial-json-parser can throw on incomplete JSON
      for await (const message of response) {
        if (controller.signal.aborted) {
          log.debug({ attemptId }, 'Query aborted');
          break;
        }

        try {
          // Log raw SDK message for debugging
          log.trace({ message }, 'SDK message received');

          // Validate SDK message structure
          if (!isValidSDKMessage(message)) {
            log.debug({ type: (message as { type?: string })?.type }, 'Invalid SDK message skipped');
            continue;
          }

          // Adapt SDK message to internal format
          const adapted = adaptSDKMessage(message);

          // Handle session ID capture
          if (adapted.sessionId) {
            instance.sessionId = adapted.sessionId;
            await sessionManager.saveSession(attemptId, adapted.sessionId);
            if (controller.signal.aborted) break; // Check after async operation
          }

          // Handle checkpoint UUID capture
          if (adapted.checkpointUuid) {
            checkpointManager.captureCheckpointUuid(attemptId, adapted.checkpointUuid);
          }

          // Track subagent workflow (from assistant messages with Task tool)
          // Also track Bash tool_uses to correlate with BGPID results
          if (message.type === 'assistant' && 'message' in message) {
            const assistantMsg = message as { message: { content: Array<{ type: string; id?: string; name?: string; input?: unknown }> }; parent_tool_use_id: string | null };
            for (const block of assistantMsg.message.content) {
              if (block.type === 'tool_use' && block.name === 'Task' && block.id) {
                const taskInput = (block as { input?: { subagent_type?: string } }).input;
                const subagentType = taskInput?.subagent_type || 'unknown';
                workflowTracker.trackSubagentStart(
                  attemptId,
                  block.id,
                  subagentType,
                  assistantMsg.parent_tool_use_id
                );
              }
              // Track Bash tool_uses for BGPID correlation
              if (block.type === 'tool_use' && block.name === 'Bash' && block.id) {
                const bashInput = block.input as { command?: string } | undefined;
                if (bashInput?.command) {
                  const toolId = block.id;
                  this.pendingBashCommands.set(toolId, { command: bashInput.command, attemptId });
                  // Clean up old entries after 5 minutes
                  setTimeout(() => this.pendingBashCommands.delete(toolId), 5 * 60 * 1000);
                }
              }
            }
          }

          // Track subagent completion and detect BGPID patterns (from user messages with tool_result)
          if (message.type === 'user' && 'message' in message) {
            const userMsg = message as { message: { content: Array<{ type: string; tool_use_id?: string; is_error?: boolean; content?: string | unknown[] }> } };
            for (const block of userMsg.message.content) {
              if (block.type === 'tool_result' && block.tool_use_id) {
                const success = !block.is_error;
                workflowTracker.trackSubagentEnd(attemptId, block.tool_use_id, success);

                // Detect BGPID pattern in tool result content (from nohup background commands)
                // Content can be string or array of {type, text} blocks
                let content = '';
                if (typeof block.content === 'string') {
                  content = block.content;
                } else if (Array.isArray(block.content)) {
                  content = (block.content as Array<{ type?: string; text?: string }>)
                    .filter(c => c && typeof c === 'object' && 'text' in c)
                    .map(c => c.text || '')
                    .join('');
                }
                log.debug({ content: content.substring(0, 200) }, 'Tool result content for BGPID check');
                const bgpidMatch = content.match(/BGPID:(\d+)/);
                const emptyBgpidMatch = content.match(/BGPID:\s*$/m) || content.trim() === 'BGPID:';

                if (bgpidMatch && block.tool_use_id) {
                  // Full BGPID with PID number
                  const pid = parseInt(bgpidMatch[1], 10);
                  log.debug({ pid }, 'BGPID detected');
                  const bashInfo = this.pendingBashCommands.get(block.tool_use_id);
                  const command = bashInfo?.command || `Background process (PID: ${pid})`;
                  const logMatch = command.match(/>\s*([^\s]+\.log)/);
                  const logFile = logMatch ? logMatch[1] : undefined;
                  log.debug({ pid, command: command.substring(0, 50) }, 'Emitting trackedProcess');
                  this.emit('trackedProcess', { attemptId, pid, command, logFile });
                  this.pendingBashCommands.delete(block.tool_use_id);
                } else if (emptyBgpidMatch && block.tool_use_id) {
                  // Empty BGPID - Claude omitted the & so $! is empty
                  // Extract actual command and spawn via backgroundShell
                  const bashInfo = this.pendingBashCommands.get(block.tool_use_id);
                  if (bashInfo?.command && this.isServerCommand(bashInfo.command)) {
                    // Extract command from nohup pattern: nohup <cmd> > /tmp/xxx.log
                    const nohupMatch = bashInfo.command.match(/nohup\s+(.+?)\s*>\s*\/tmp\//);
                    if (nohupMatch) {
                      const actualCommand = nohupMatch[1].trim();
                      log.debug({ actualCommand }, 'Empty BGPID detected, spawning shell');
                      this.emit('backgroundShell', {
                        attemptId,
                        shell: { toolUseId: block.tool_use_id, command: actualCommand, description: 'Auto-spawned from empty BGPID', originalCommand: bashInfo.command },
                      });
                    }
                  }
                  this.pendingBashCommands.delete(block.tool_use_id);
                }
              }
            }
          }

          // Track usage stats from result messages
          if (message.type === 'result') {
            const resultMsg = message as SDKResultMessage;
            usageTracker.trackResult(attemptId, resultMsg);
          }

          // Note: AskUserQuestion is now handled via canUseTool callback
          // which properly pauses streaming until user responds

          // Handle background shell (Bash with run_in_background=true)
          if (adapted.backgroundShell) {
            this.emit('backgroundShell', {
              attemptId,
              shell: adapted.backgroundShell,
            });
          }

          // Emit adapted message
          // If using custom output format, suppress the default 'result' output
          // We will read the file and emit our own result at the end
          if (!(adapted.output.type === 'result' && instance.outputFormat)) {
            if (instance.outputFormat) {
              adapted.output.outputFormat = instance.outputFormat;
            }
            this.emit('json', { attemptId, data: adapted.output });
          }
        } catch (messageError) {
          // Handle per-message errors (e.g., SDK's partial-json-parser failures)
          // Log but continue streaming - don't let one bad message kill the stream
          const errorMsg = messageError instanceof Error ? messageError.message : 'Unknown message error';
          log.error({ err: messageError, message: errorMsg }, 'Message processing error');

          // Only emit if it's a significant error (not just parsing issues)
          if (!errorMsg.includes('Unexpected end of JSON')) {
            this.emit('stderr', { attemptId, content: `Warning: ${errorMsg}` });
          }
        }
      }

      // Query completed successfully
      log.info({ attemptId, durationMs: Date.now() - instance.startedAt }, 'Query completed successfully');

      // Output Format Handling: Read the custom output file if requested
      if (instance.outputFormat) {
        try {
          const fs = require('fs');
          const dataDir = process.env.DATA_DIR || process.cwd();
          const outputFilePath = resolve(dataDir, 'tmp', `${attemptId}.${instance.outputFormat}`);

          if (fs.existsSync(outputFilePath)) {
            console.log(`[AgentManager] Reading custom output file: ${outputFilePath}`);
            const fileContent = fs.readFileSync(outputFilePath, 'utf-8');

            // Emit as a 'result' event so server.ts handles it
            this.emit('json', {
              attemptId,
              data: {
                type: 'result',
                subtype: 'success',
                is_error: false,
                content: fileContent,
                outputFormat: instance.outputFormat
              } as any
            });
          } else {
            console.warn(`[AgentManager] Expected output file not found: ${outputFilePath}`);
            this.emit('stderr', { attemptId, content: `Error: Expected output file not found: ${outputFilePath}` });
          }
        } catch (readError) {
          console.error(`[AgentManager] Failed to read output file:`, readError);
        }
      }

      // Collect git stats snapshot on completion
      try {
        const gitStats = await collectGitStats(projectPath);
        if (gitStats) {
          gitStatsCache.set(attemptId, gitStats);
        }
      } catch (gitError) {
        // Git stats collection failed - continue without it
      }

      // Clean up any pending questions for this attempt
      if (this.pendingQuestions.has(attemptId)) {
        const pending = this.pendingQuestions.get(attemptId);
        if (pending) {
          pending.resolve(null); // Resolve with null to unblock the canUseTool callback
        }
        this.pendingQuestions.delete(attemptId);
        this.pendingQuestionData.delete(attemptId);
      }

      this.agents.delete(attemptId);
      this.emit('exit', { attemptId, code: 0 });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      const wasResuming = !!sessionOptions?.resume;
      const wasAborted = controller.signal.aborted;

      log.error({
        err: error,
        message: errorMessage,
        errorName,
        attemptId,
        projectPath,
        hasResume: wasResuming,
        resumeSessionAt: sessionOptions?.resumeSessionAt,
      }, 'SDK Error - Query failed');
      if (error instanceof Error && error.stack) {
        log.error({ stack: error.stack.split('\n').slice(0, 8).join('\n') }, 'SDK Error Stack (first 8 lines)');
      }

      // Retry without resume if the failure was during a resume attempt
      // This handles stale/incompatible sessions that pass file validation but crash the CLI
      // Silent retry — no stderr emission so the client doesn't see a visible error
      if (wasResuming && !wasAborted) {
        log.warn({ attemptId, sessionId: sessionOptions?.resume }, 'Resume failed, retrying without resume (fresh session)');

        // Re-register instance (was deleted on error path otherwise)
        this.agents.set(attemptId, instance);

        // Retry without session options
        return this.runQuery(instance, projectPath, prompt, undefined, checkpointOptions, maxTurns, model);
      }

      this.emit('stderr', { attemptId, content: `${errorName}: ${errorMessage}` });

      // Determine exit code based on error type
      const code = wasAborted ? null : 1;

      // Clean up any pending questions for this attempt
      if (this.pendingQuestions.has(attemptId)) {
        const pending = this.pendingQuestions.get(attemptId);
        if (pending) {
          pending.resolve(null); // Resolve with null to unblock the canUseTool callback
        }
        this.pendingQuestions.delete(attemptId);
        this.pendingQuestionData.delete(attemptId);
      }

      this.agents.delete(attemptId);
      this.emit('exit', { attemptId, code });
    }
  }

  /**
   * Answer a pending AskUserQuestion
   * Resolves the waiting canUseTool callback and resumes streaming
   */
  answerQuestion(attemptId: string, toolUseId: string | undefined, questions: unknown[], answers: Record<string, string>): boolean {
    const pending = this.pendingQuestions.get(attemptId);
    if (!pending) {
      return false;
    }

    // Validate toolUseId if provided - prevents stale answers for wrong question
    if (toolUseId && pending.toolUseId !== toolUseId) {
      log.warn({ attemptId, expectedToolUseId: pending.toolUseId, receivedToolUseId: toolUseId }, 'Rejecting stale answer for wrong toolUseId');
      return false;
    }

    // Resolve the pending Promise - SDK will resume streaming
    pending.resolve({ questions, answers });
    this.pendingQuestions.delete(attemptId);
    this.pendingQuestionData.delete(attemptId);
    return true;
  }

  /**
   * Cancel a pending AskUserQuestion (user clicked cancel/escape)
   * Returns deny to tell Claude the user declined
   */
  cancelQuestion(attemptId: string): boolean {
    const pending = this.pendingQuestions.get(attemptId);
    if (!pending) {
      return false;
    }

    // Resolve with null to signal cancellation
    // canUseTool callback will return { behavior: 'deny' }
    pending.resolve(null);
    this.pendingQuestions.delete(attemptId);
    this.pendingQuestionData.delete(attemptId);
    return true;
  }

  /**
   * Check if there's a pending question for an attempt
   */
  hasPendingQuestion(attemptId: string): boolean {
    return this.pendingQuestions.has(attemptId);
  }

  /**
   * Get pending question data for an attempt (used by reconnecting clients)
   */
  getPendingQuestionData(attemptId: string): { toolUseId: string; questions: unknown[]; timestamp: number } | null {
    return this.pendingQuestionData.get(attemptId) || null;
  }

  /**
   * Send input to a running agent (legacy method)
   * @deprecated Use answerQuestion() for AskUserQuestion responses
   */
  async sendInput(attemptId: string, _input: string): Promise<boolean> {
    const instance = this.agents.get(attemptId);
    if (!instance || !instance.sessionId) {
      return false;
    }

    // For SDK, we need to start a new query with resume
    // This will be handled by creating a new attempt in server.ts
    // Return false to signal caller should create continuation attempt
    return false;
  }

  /**
   * Cancel a running agent
   * Uses SDK Query.close() for graceful termination, falls back to AbortController
   */
  cancel(attemptId: string): boolean {
    const instance = this.agents.get(attemptId);
    if (!instance) return false;

    // Clean up any pending questions for this attempt
    const pending = this.pendingQuestions.get(attemptId);
    if (pending) {
      pending.resolve(null); // Resolve with null to unblock and signal cancellation
      this.pendingQuestions.delete(attemptId);
      this.pendingQuestionData.delete(attemptId);
    }

    // Graceful close via SDK (cleans up subprocess, MCP transports, pending requests)
    if (instance.queryRef) {
      try {
        instance.queryRef.close();
      } catch {
        // Fallback to abort if close() fails
        instance.controller.abort();
      }
    } else {
      instance.controller.abort();
    }

    this.agents.delete(attemptId);
    return true;
  }

  /**
   * Cancel all running agents
   * Uses SDK Query.close() for graceful termination per agent
   */
  cancelAll(): void {
    // Clean up all pending questions first
    for (const [, pending] of this.pendingQuestions) {
      pending.resolve(null);
    }
    this.pendingQuestions.clear();
    this.pendingQuestionData.clear();

    // Graceful close all agents via SDK
    for (const [, instance] of this.agents) {
      if (instance.queryRef) {
        try {
          instance.queryRef.close();
        } catch {
          instance.controller.abort();
        }
      } else {
        instance.controller.abort();
      }
    }
    this.agents.clear();
  }

  /**
   * Check if an agent is running
   */
  isRunning(attemptId: string): boolean {
    return this.agents.has(attemptId);
  }

  /**
   * Get running agent count
   */
  get runningCount(): number {
    return this.agents.size;
  }

  /**
   * Get all running attempt IDs
   */
  getRunningAttempts(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get session ID for a running agent
   */
  getSessionId(attemptId: string): string | undefined {
    return this.agents.get(attemptId)?.sessionId;
  }

  // Type-safe event emitter methods
  override on<K extends keyof AgentEvents>(
    event: K,
    listener: AgentEvents[K]
  ): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof AgentEvents>(
    event: K,
    ...args: Parameters<AgentEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}

// Export singleton instance
// Use globalThis to ensure the same instance is shared across module contexts
// (e.g., between server.ts and Next.js API routes)
const globalKey = '__claude_agent_manager__' as const;

declare global {
  var __claude_agent_manager__: AgentManager | undefined;
}

export const agentManager: AgentManager =
  (globalThis as any)[globalKey] ?? new AgentManager();

// Store in global for cross-module access
if (!(globalThis as any)[globalKey]) {
  (globalThis as any)[globalKey] = agentManager;
}
