import { spawn } from 'child_process';

export interface ContextUsage {
  totalTokens: number;
  maxTokens: number;
  percentage: number;
  systemPrompt: number;
  systemTools: number;
  customAgents: number;
  memoryFiles: number;
  skills: number;
  messages: number;
  freeSpace: number;
  autocompactBuffer: number;
}

/**
 * Captures context usage by running the /context command in the Claude CLI session
 */
export async function captureContextUsage(
  sessionId: string,
  cwd: string
): Promise<ContextUsage | null> {
  try {
    console.log(`[ContextTracker] Capturing context usage for session ${sessionId}`);

    return await new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';

      // Run: echo "/context" | claude --resume <sessionId>
      const child = spawn(
        'bash',
        [
          '-c',
          `echo "/context" | claude --resume ${sessionId}`,
        ],
        {
          cwd,
          env: { ...process.env },
        }
      );

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          console.error(`[ContextTracker] Failed to capture context: ${errorOutput}`);
          resolve(null);
          return;
        }

        try {
          const parsed = parseContextOutput(output);
          console.log(`[ContextTracker] Captured context usage: ${parsed.totalTokens}/${parsed.maxTokens} tokens (${parsed.percentage}%)`);
          resolve(parsed);
        } catch (error) {
          console.error('[ContextTracker] Failed to parse context output:', error);
          resolve(null);
        }
      });

      child.on('error', (error) => {
        console.error('[ContextTracker] Failed to spawn process:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('[ContextTracker] Error capturing context usage:', error);
    return null;
  }
}

/**
 * Parses the /context command output to extract usage statistics
 */
function parseContextOutput(output: string): ContextUsage {
  // Example output:
  // claude-opus-4-5-20251101 · 37k/200k tokens (19%)
  // System prompt: 3.2k tokens (1.6%)
  // System tools: 21.9k tokens (11.0%)
  // Custom agents: 5.5k tokens (2.7%)
  // Memory files: 3.1k tokens (1.5%)
  // Skills: 3.7k tokens (1.8%)
  // Messages: 53 tokens (0.0%)
  // Free space: 118k (58.8%)
  // Autocompact buffer: 45.0k tokens (22.5%)

  const lines = output.split('\n');

  // Parse total from first line (e.g., "37k/200k tokens (19%)")
  const totalMatch = lines[0]?.match(/(\d+(?:\.\d+)?k?)\/(\d+(?:\.\d+)?k?)\s+tokens\s+\((\d+)%\)/);
  if (!totalMatch) {
    throw new Error('Failed to parse total tokens from context output');
  }

  const totalTokens = parseTokenValue(totalMatch[1]);
  const maxTokens = parseTokenValue(totalMatch[2]);
  const percentage = parseInt(totalMatch[3], 10);

  // Parse component lines
  const systemPrompt = extractTokenValue(output, 'System prompt:');
  const systemTools = extractTokenValue(output, 'System tools:');
  const customAgents = extractTokenValue(output, 'Custom agents:');
  const memoryFiles = extractTokenValue(output, 'Memory files:');
  const skills = extractTokenValue(output, 'Skills:');
  const messages = extractTokenValue(output, 'Messages:');
  const freeSpace = extractTokenValue(output, 'Free space:');
  const autocompactBuffer = extractTokenValue(output, 'Autocompact buffer:');

  return {
    totalTokens,
    maxTokens,
    percentage,
    systemPrompt,
    systemTools,
    customAgents,
    memoryFiles,
    skills,
    messages,
    freeSpace,
    autocompactBuffer,
  };
}

/**
 * Extracts token value from a line like "System prompt: 3.2k tokens (1.6%)"
 */
function extractTokenValue(output: string, label: string): number {
  const regex = new RegExp(`${label}\\s+(\\d+(?:\\.\\d+)?k?)\\s+tokens`, 'i');
  const match = output.match(regex);
  return match ? parseTokenValue(match[1]) : 0;
}

/**
 * Converts token string like "37k", "3.2k", "53" to actual number
 */
function parseTokenValue(value: string): number {
  if (value.endsWith('k')) {
    return Math.round(parseFloat(value.slice(0, -1)) * 1000);
  }
  return parseInt(value, 10);
}
