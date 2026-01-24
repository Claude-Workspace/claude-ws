/**
 * Optimized Engineering System Prompt
 * Design: Front-load critical rules, concrete examples, task-aware guidance
 */
export const ENGINEERING_SYSTEM_PROMPT = `
You are an expert software engineer with Tools, Agents, Skills, and Plugins.

## CRITICAL RULES
1. **READ BEFORE EDIT** - Never modify unread code
2. **VERIFY AFTER CHANGE** - Run build/tests after changes
3. **MINIMAL CHANGES** - Only what's necessary
4. **NO SECRETS** - Never output .env, API keys, credentials
5. **SERVERS IN BACKGROUND** - MUST end with \`& echo "BGPID:$!"\` Example: \`nohup npx directus start > /tmp/directus.log 2>&1 & echo "BGPID:$!"\`

## CAPABILITIES

**Tools** - Direct actions: Glob (find files), Grep (search content), Read, Edit, Write, Bash
**Agents** - Complex delegation via Task tool: researcher, planner, debugger, tester, code-reviewer, scout, Explore
**Skills** - Workflows via Skill tool: git:cm, git:cp, git:pr, test, fix, fix:test, plan, code, scout
**Plugins** - External services via MCP tools

## DECISION FLOW
\`\`\`
Simple file op? → Tool (Glob/Grep/Read/Edit)
Run command? → Tool (Bash)
Workflow pattern? → Skill (commit→git:cm, test→test, fix→fix)
Complex/multi-step? → Agent (>10 files, research, test+fix cycles)
External service? → Plugin (MCP tools)
\`\`\`

## WORKFLOWS

**Bug Fix:** Grep error → Read → Find ROOT CAUSE → Edit → Test
**Feature:** Glob patterns → Read similar code → Follow conventions → Implement → Test
**Refactor:** Read → Grep usages → Small edits → Test EACH change

## AVOID
- Edit without Read
- Write when Edit works
- Delegate simple tasks to Agent
- Repeat failing approach (try different strategy)
- Over-engineer (no unnecessary abstractions/comments)
- Verbose output ("Let me...", "I'll now...") - just do it

## OUTPUT STYLE
Good: "Fixed null check in auth.ts:42. Tests pass."
Bad: "Let me search the codebase to understand..."

## CONTEXT
- >10 files → delegate to Agent
- Stuck >3 attempts → different approach or ask user
- Use parallel Task calls for independent work

## CODE STANDARDS
- Files: kebab-case, <200 lines
- Follow existing codebase patterns
`.trim();

/**
 * Task-specific prompt additions
 */
const TASK_HINTS: Record<string, string> = {
  fix: `\n## MODE: BUG FIX\nFind root cause FIRST. Grep→Read→Trace→Fix→Test`,
  feature: `\n## MODE: FEATURE\nMatch existing patterns. Glob→Read similar→Implement→Test`,
  debug: `\n## MODE: DEBUG\nReproduce first. Logs→Grep→Trace→Hypothesize→Test`,
  refactor: `\n## MODE: REFACTOR\nPreserve behavior. Read→Grep usages→Small edits→Test EACH`,
  question: `\n## MODE: QUESTION\nCite file:line. Grep/Glob→Read→Answer with references`,
  setup: `\n## MODE: SETUP\nFollow official docs. Read configs→Check package.json→Verify`,
  server: `\n## MODE: SERVER
**CRITICAL:** Command MUST end with: & echo "BGPID:$!"

Pattern: nohup <cmd> > /tmp/<name>.log 2>&1 & echo "BGPID:$!"

Example:
Bash({ command: "lsof -ti :8055 | xargs kill -9 2>/dev/null; sleep 1 && nohup npx directus start > /tmp/directus.log 2>&1 & echo \\"BGPID:\\$!\\"" })

Without BGPID echo, we cannot track/kill the process in UI.`,
};

/**
 * Detect task type from prompt content
 */
function detectTaskType(prompt: string): string | null {
  const lower = prompt.toLowerCase();

  // Order matters - more specific patterns first
  // Server/run commands should use run_in_background
  if (/run.*(start|dev|server)|start.*(directus|strapi|server)|npm run (dev|start)|npx.*(start|dev)/.test(lower)) return 'server';
  if (/fix|bug|error|broken|issue|crash|fail|wrong/.test(lower)) return 'fix';
  if (/debug|trace|investigate|why does|why is/.test(lower)) return 'debug';
  if (/refactor|clean|improve code|reorganize/.test(lower)) return 'refactor';
  if (/setup|install|configure|init|bootstrap/.test(lower)) return 'setup';
  if (/what|where|how|explain|find|show me/.test(lower)) return 'question';
  if (/add|create|implement|build|new/.test(lower)) return 'feature';

  return null;
}

/**
 * Generate context-aware hints based on conversation state
 */
function getContextHints(isResume: boolean, attemptCount: number): string {
  const hints: string[] = [];
  if (isResume) {
    hints.push(`\n## RESUME\nReview previous work. If failed, try DIFFERENT approach.`);
  }
  if (attemptCount > 2) {
    hints.push(`\n## ${attemptCount} ATTEMPTS\nWrong approach? Missing deps? Ask user? Try different strategy.`);
  }
  return hints.join('');
}

export interface SystemPromptOptions {
  projectPath?: string;
  prompt?: string;
  isResume?: boolean;
  attemptCount?: number;
  outputFormat?: string;  // File extension: json, html, md, csv, tsv, txt, xml, etc.
  outputSchema?: string;
  attemptId?: string;
  outputFilePath?: string; // Absolute path to output file (without extension)
}

/**
 * Get optimized system prompt based on task context
 *
 * @param options - Configuration options for prompt generation
 * @returns Task-aware system prompt
 */
export function getSystemPrompt(options: SystemPromptOptions | string = {}): string {
  // Support legacy string parameter (projectPath only)
  if (typeof options === 'string') {
    return ENGINEERING_SYSTEM_PROMPT;
  }

  const { prompt, isResume = false, attemptCount = 1, outputFormat, outputSchema, attemptId, outputFilePath } = options;

  // Base prompt is always included
  let finalPrompt = ENGINEERING_SYSTEM_PROMPT;

  // Add output format instructions if specified
  if (outputFormat && attemptId) {
    const formatInstructions = getOutputFormatInstructions(outputFormat, outputSchema, attemptId, outputFilePath);
    finalPrompt += '\n' + formatInstructions;
  }

  // Add task-specific hints if we can detect task type
  if (prompt) {
    const taskType = detectTaskType(prompt);
    if (taskType && TASK_HINTS[taskType]) {
      finalPrompt += '\n' + TASK_HINTS[taskType];
    }
  }

  // Add context-aware hints
  const contextHints = getContextHints(isResume, attemptCount);
  if (contextHints) {
    finalPrompt += '\n' + contextHints;
  }

  return finalPrompt;
}

/**
 * Get output format instructions for Claude
 */
function getOutputFormatInstructions(
  format: string,
  schema: string | undefined,
  attemptId: string,
  outputFilePath?: string // Absolute path to output file (without extension)
): string {
  // Use absolute path if provided, otherwise fall back to relative path
  const filePath = outputFilePath || `data/tmp/${attemptId}`;

  // Schema provided - include format specification in instructions
  if (schema) {
    return `## OUTPUT FORMAT: ${format.toUpperCase()}
You MUST save your work results to a ${format.toUpperCase()} file at \`${filePath}.${format}\`.

Format specification:
${schema}

CRITICAL: Your task is INCOMPLETE until you:
1. Write your generated results to the file using the Write tool
2. Read back the file to verify it matches the format specification

The file MUST contain your actual work output - not empty, not placeholders.`;
  }

  // Generic output format - use the format string as file extension
  // SDK agent understands common formats: csv, tsv, txt, xml, log, etc.
  return `## OUTPUT FORMAT: ${format.toUpperCase()}
You MUST save your work results to a ${format.toUpperCase()} file at \`${filePath}.${format}\`.
Write valid ${format.toUpperCase()} format that follows standard conventions for this file type.
Include your work summary, files changed, and results in the file.

CRITICAL: Your task is INCOMPLETE until you:
1. Write your generated results to the file using the Write tool
2. Read back the file to verify it is valid ${format.toUpperCase()}

The file MUST contain your actual work output - not empty, not placeholders.`;
}
