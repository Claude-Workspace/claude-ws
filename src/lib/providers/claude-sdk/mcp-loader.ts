/**
 * MCP Server Configuration Loader
 *
 * Loads and merges MCP server configs from multiple sources:
 * - ~/.claude.json (global)
 * - ~/.claude.json projects[path] (CLI per-project)
 * - {projectPath}/.mcp.json (project file)
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// MCP Server configuration types matching SDK's McpServerConfig union
export interface MCPStdioServerConfig {
  type?: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MCPHttpServerConfig {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}

export interface MCPSSEServerConfig {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
}

export type MCPServerConfig = MCPStdioServerConfig | MCPHttpServerConfig | MCPSSEServerConfig;

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
    console.warn(`[MCP Loader] Failed to parse ${configPath}:`, error);
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
export function loadMCPConfig(projectPath: string): MCPConfig | null {
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
        console.log(`[MCP Loader] Loaded global MCP config from ${claudeConfigPath}:`, Object.keys(userServers || {}));
      }

      // 2. Per-project mcpServers (CLI style) - overrides global
      if (config.projects && config.projects[projectPath]?.mcpServers) {
        const projectServers = config.projects[projectPath].mcpServers as Record<string, MCPServerConfig>;
        if (Object.keys(projectServers).length > 0) {
          userServers = { ...(userServers || {}), ...projectServers };
          console.log(`[MCP Loader] Loaded CLI project MCP config for ${projectPath}:`, Object.keys(projectServers));
        }
      }
    } catch (error) {
      console.warn(`[MCP Loader] Failed to parse ${claudeConfigPath}:`, error);
    }
  }

  // Load project config (overrides user)
  const projectServers = loadSingleMCPConfig(projectConfigPath);
  if (projectServers) {
    console.log(`[MCP Loader] Loaded project MCP config from ${projectConfigPath}:`, Object.keys(projectServers));
  }

  // Merge: project overrides user
  const mergedServers: Record<string, MCPServerConfig> = {
    ...(userServers || {}),
    ...(projectServers || {}),
  };

  if (Object.keys(mergedServers).length === 0) {
    console.log(`[MCP Loader] No MCP servers found in user or project config`);
    return null;
  }

  // Interpolate environment variables
  interpolateEnvVars(mergedServers);

  // Log merged servers
  console.log(`[MCP Loader] Merged MCP servers:`, Object.keys(mergedServers));
  for (const [name, cfg] of Object.entries(mergedServers)) {
    const serverType = cfg.type || 'stdio';
    const endpoint = 'url' in cfg ? cfg.url : ('command' in cfg ? cfg.command : 'unknown');
    console.log(`[MCP Loader]   - ${name}: ${serverType} ${endpoint}`);
  }

  return { mcpServers: mergedServers };
}

/**
 * Generate allowed MCP tools wildcards from server names
 */
export function getMCPToolWildcards(mcpServers: Record<string, MCPServerConfig>): string[] {
  return Object.keys(mcpServers).map(serverName => `mcp__${serverName}__*`);
}
