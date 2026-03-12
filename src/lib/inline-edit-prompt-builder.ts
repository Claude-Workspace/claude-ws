/**
 * Inline Edit Prompt Builder - Construct Claude prompts for inline code editing sessions
 *
 * Extracted from inline-edit-manager.ts. Builds structured prompts with surrounding
 * context and extracts clean code from Claude's response (strips markdown fences, etc.).
 */

/**
 * Build the prompt for a Claude inline edit request.
 * Includes surrounding context sections when provided.
 */
export function buildInlineEditPrompt(
  language: string,
  selectedCode: string,
  instruction: string,
  beforeContext?: string,
  afterContext?: string
): string {
  const langName = language || 'code';

  let contextSection = '';
  if (beforeContext || afterContext) {
    contextSection = `
<surrounding-context>
${beforeContext ? `<before>\n${beforeContext}\n</before>` : ''}
${afterContext ? `<after>\n${afterContext}\n</after>` : ''}
</surrounding-context>
`;
  }

  return `You are a code editor assistant. Your task is to modify the given ${langName} code according to the user's instruction.

IMPORTANT RULES:
1. Output ONLY the modified code - no explanations, no markdown fences, no comments about what you changed
2. Preserve the original indentation style
3. Make minimal changes to accomplish the instruction
4. If the instruction is unclear, make your best interpretation
5. If the code cannot be modified as requested, output the original code unchanged
${contextSection}
<selected-code>
${selectedCode}
</selected-code>

<instruction>
${instruction}
</instruction>

Output the modified code now:`;
}

/**
 * Extract clean code from Claude's response.
 * Strips markdown code fences or wrapping backticks if present.
 */
export function extractCodeFromResponse(response: string): string {
  let code = response.trim();

  // Remove markdown code fences if present
  const fenceMatch = code.match(/^```[\w]*\n?([\s\S]*?)```$/);
  if (fenceMatch) {
    code = fenceMatch[1].trim();
  }

  // Remove single backticks if wrapping the whole response
  if (code.startsWith('`') && code.endsWith('`') && !code.includes('\n')) {
    code = code.slice(1, -1);
  }

  return code;
}
