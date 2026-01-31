/**
 * Gemini CLI Process Manager
 *
 * Spawns and manages Gemini CLI child processes with NDJSON streaming.
 */

import { spawn, type ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { execSync } from 'child_process';

export interface GeminiProcessOptions {
  cwd: string;
  prompt: string;
  model?: string;
  contextPaths?: string[];
  abortSignal?: AbortSignal;
  sessionUuid?: string; // Resume specific session by UUID
}

export interface GeminiProcess {
  process: ChildProcess;
  lines: AsyncIterable<string>;
}

/**
 * Spawn Gemini CLI process with NDJSON streaming output
 */
export async function spawnGeminiProcess(
  options: GeminiProcessOptions
): Promise<GeminiProcess> {
  const { cwd, prompt, model = 'gemini-2.5-flash', contextPaths = [], abortSignal } = options;

  const args: string[] = [];

  // Add context paths
  for (const path of contextPaths) {
    args.push(path);
  }

  // Add model selection
  args.push('--model', model);

  // Enable YOLO mode (auto-approve all tools)
  args.push('--yolo');

  // Enable JSON streaming
  args.push('--output-format', 'stream-json');

  // Resume specific session by UUID if provided
  if (options.sessionUuid) {
    args.push('--resume', options.sessionUuid);
  }

  // Add prompt
  args.push(prompt);

  const proc = spawn('gemini', args, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  // Handle abort signal
  if (abortSignal) {
    abortSignal.addEventListener('abort', () => {
      proc.kill('SIGTERM');
    });
  }

  const rl = createInterface({ input: proc.stdout });

  async function* lineGenerator(): AsyncIterable<string> {
    for await (const line of rl) {
      yield line;
    }
  }

  return {
    process: proc,
    lines: lineGenerator(),
  };
}

/**
 * Check if Gemini CLI is installed and available
 */
export function isGeminiInstalled(): boolean {
  try {
    execSync('which gemini', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
