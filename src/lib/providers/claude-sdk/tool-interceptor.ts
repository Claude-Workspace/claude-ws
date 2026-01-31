/**
 * Tool Interception Logic for Claude SDK
 *
 * Handles AskUserQuestion pausing and Bash command BGPID pattern fixing.
 */

// Pending question resolver type
export interface PendingQuestion {
  toolUseId: string;
  resolve: (answer: QuestionAnswer | null) => void;
}

// Answer format for AskUserQuestion tool
export interface QuestionAnswer {
  questions: unknown[];
  answers: Record<string, string>;
}

// Tool intercept result type matching SDK's PermissionResult
export type ToolInterceptResult =
  | { behavior: 'allow'; updatedInput?: Record<string, unknown> }
  | { behavior: 'deny'; message: string; interrupt?: boolean; toolUseID?: string };

/**
 * Check if command is a server/dev command that should run in background
 */
export function isServerCommand(command: string): boolean {
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
 * Create tool interceptor callback for SDK canUseTool
 *
 * Handles:
 * - AskUserQuestion: pauses streaming until user responds
 * - Bash: fixes incomplete BGPID patterns for background commands
 */
export function createToolInterceptor(
  attemptId: string,
  pendingQuestions: Map<string, PendingQuestion>,
  onQuestion: (toolUseId: string, questions: unknown[]) => void
): (toolName: string, input: Record<string, unknown>) => Promise<ToolInterceptResult> {
  return async (toolName: string, input: Record<string, unknown>): Promise<ToolInterceptResult> => {
    console.log('[Tool Interceptor] canUseTool called:', { toolName, attemptId });

    // Handle AskUserQuestion tool - pause and wait for user input
    if (toolName === 'AskUserQuestion') {
      console.log('[Tool Interceptor] AskUserQuestion detected', { attemptId, input });

      // Prevent duplicate questions for same attempt
      if (pendingQuestions.has(attemptId)) {
        console.log('[Tool Interceptor] Duplicate question blocked for', attemptId);
        return { behavior: 'deny', message: 'Duplicate question' };
      }

      const toolUseId = `ask-${Date.now()}`;
      const questions = (input.questions as unknown[]) || [];
      console.log('[Tool Interceptor] Emitting question event:', { attemptId, toolUseId, questionCount: questions.length });

      // Emit question event to frontend (streaming is paused here)
      onQuestion(toolUseId, questions);

      // Wait for user answer (no timeout - user can take as long as needed)
      const answer = await new Promise<QuestionAnswer | null>((resolve) => {
        pendingQuestions.set(attemptId, { toolUseId, resolve });
      });

      // Clean up pending question
      pendingQuestions.delete(attemptId);

      // Check if cancellation (null/empty answers)
      if (!answer || Object.keys(answer.answers).length === 0) {
        return { behavior: 'deny', message: 'User cancelled' };
      }

      // Return allow with user's answers (cast to Record<string, unknown> for SDK)
      return {
        behavior: 'allow',
        updatedInput: answer as unknown as Record<string, unknown>,
      };
    }

    // Intercept Bash commands to fix incomplete BGPID patterns
    if (toolName === 'Bash') {
      const command = input.command as string | undefined;
      if (command && isServerCommand(command) && !command.includes('echo "BGPID:$!"')) {
        // Fix incomplete nohup pattern - add missing 2>&1 & echo "BGPID:$!"
        let fixedCommand = command;
        // Pattern: ends with "> /tmp/xxx.log" or "> /tmp/xxx.log " without the full suffix
        if (/>\s*\/tmp\/[^\s]+\.log\s*$/.test(command)) {
          fixedCommand = command.trim() + ' 2>&1 & echo "BGPID:$!"';
          console.log('[Tool Interceptor] Fixed BGPID pattern:', fixedCommand);
          return { behavior: 'allow', updatedInput: { ...input, command: fixedCommand } };
        }
      }
    }

    // Auto-allow all other tools (bypassPermissions mode)
    return { behavior: 'allow', updatedInput: input };
  };
}
