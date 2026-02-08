import { join } from 'path';
import { homedir } from 'os';

/**
 * Get the data directory path
 * Uses DATA_DIR from environment if set, otherwise user's CWD/data
 */
export function getDataDir(): string {
  const userCwd = process.env.CLAUDE_WS_USER_CWD || process.cwd();
  return process.env.DATA_DIR || join(userCwd, 'data');
}

/**
 * Get the Agent Factory directory path
 * Uses DATA_DIR/agent-factory if DATA_DIR is set, otherwise {project}/data/agent-factory
 */
export function getAgentFactoryDir(): string {
  return join(getDataDir(), 'agent-factory');
}

/**
 * Get the global Claude directory path (~/.claude)
 * This is where globally installed plugins are stored
 */
export function getGlobalClaudeDir(): string {
  return join(homedir(), '.claude');
}
