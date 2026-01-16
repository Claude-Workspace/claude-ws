import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { dependencyExtractor } from '@/lib/dependency-extractor';

const execAsync = promisify(exec);

export interface LibraryDep {
  name: string;
  version?: string;
  manager: 'npm' | 'pnpm' | 'yarn' | 'pip' | 'poetry' | 'cargo' | 'go' | 'composer' | 'gem';
}

export interface PluginDep {
  type: 'skill' | 'command' | 'agent';
  name: string;
}

export interface AnalysisResult {
  libraries: LibraryDep[];
  plugins: PluginDep[];
  installScripts?: {
    npm?: string;
    pnpm?: string;
    yarn?: string;
    pip?: string;
    poetry?: string;
    cargo?: string;
    go?: string;
    dockerfile?: string;
  };
}

/**
 * Claude SDK Dependency Analyzer
 * Uses Claude CLI to intelligently analyze code for dependencies
 */
export class ClaudeDependencyAnalyzer {
  private readonly claudePath: string;

  constructor() {
    // Try to find claude CLI path
    this.claudePath = process.env.CLAUDE_CLI_PATH || 'claude';
  }

  /**
   * Analyze component dependencies using Claude SDK
   */
  async analyze(sourcePath: string, type: string): Promise<AnalysisResult> {
    try {
      // Check if source exists
      if (!existsSync(sourcePath)) {
        return { libraries: [], plugins: [] };
      }

      // Collect source files
      const files = await this.collectSourceFiles(sourcePath, type);
      if (files.length === 0) {
        return { libraries: [], plugins: [] };
      }

      // Build analysis prompt
      const prompt = this.buildAnalysisPrompt(files, type);

      // Call Claude CLI
      const result = await this.callClaude(prompt);

      // Parse result
      const parsed = this.parseAnalysisResult(result);

      // If Claude returned no results, fall back to regex extraction
      if (parsed.libraries.length === 0 && parsed.plugins.length === 0) {
        console.warn('Claude returned no results, falling back to regex extraction');
        const fallback = await dependencyExtractor.extract(sourcePath, type);
        return {
          libraries: fallback.libraries,
          plugins: fallback.plugins,
        };
      }

      return parsed;
    } catch (error) {
      console.error('Claude analysis failed:', error);
      // Fallback to regex extraction
      console.warn('Falling back to regex extraction');
      const fallback = await dependencyExtractor.extract(sourcePath, type);
      return {
        libraries: fallback.libraries,
        plugins: fallback.plugins,
      };
    }
  }

  /**
   * Collect all source files for analysis
   */
  private async collectSourceFiles(sourcePath: string, type: string): Promise<Array<{ path: string; content: string }>> {
    const files: Array<{ path: string; content: string }> = [];
    const isDirectory = type === 'skill';

    if (isDirectory) {
      const collect = async (dir: string, baseDir: string): Promise<void> => {
        try {
          const entries = await readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name.startsWith('mod')) {
              continue;
            }
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
              await collect(fullPath, baseDir);
            } else if (entry.isFile() && this.isSourceFile(entry.name)) {
              const content = await readFile(fullPath, 'utf-8');
              const relativePath = fullPath.substring(baseDir.length);
              files.push({ path: relativePath, content });
            }
          }
        } catch {
          // Skip directories we can't read
        }
      };
      await collect(sourcePath, sourcePath);
    } else {
      // Single file
      const content = await readFile(sourcePath, 'utf-8');
      files.push({ path: sourcePath, content });
    }

    return files;
  }

  /**
   * Check if file is a source file
   */
  private isSourceFile(filename: string): boolean {
    const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.rb', '.php'];
    return sourceExtensions.some(ext => filename.endsWith(ext));
  }

  /**
   * Build analysis prompt for Claude
   */
  private buildAnalysisPrompt(files: Array<{ path: string; content: string }>, type: string): string {
    const fileContents = files.map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n');

    return `You are a code analysis expert. Analyze the following ${type} code and extract dependencies.

**Output Format (JSON only):**
\`\`\`json
{
  "libraries": [
    {"name": "package-name", "version": "1.0.0", "manager": "npm"}
  ],
  "components": [
    {"type": "skill", "name": "skill-name"},
    {"type": "command", "name": "command-name"},
    {"type": "agent", "name": "agent-name"}
  ]
}
\`\`\`

**Rules:**
1. **Library dependencies**: Extract external package/library imports
   - npm: packages from import/require statements
   - pip: Python imports (excluding stdlib)
   - cargo: Rust external crates
   - go: Go external modules

2. **Component dependencies**: Extract references to other skills/commands/agents
   - Look for: skill: "name", command: "name", agent: "name"
   - Look for: useSkill('name'), useCommand('name'), useAgent('name')
   - Look for: /skill:name, /command:name, /agent:name

3. Return ONLY valid JSON, no markdown formatting

**Code to analyze:**
${fileContents}`;
  }

  /**
   * Call Claude CLI with the prompt
   */
  private async callClaude(prompt: string): Promise<string> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        // Use claude CLI to analyze
        const { stdout } = await execAsync(
          `"${this.claudePath}" "${prompt.replace(/"/g, '\\"')}"`,
          { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }
        );
        return stdout;
      } catch (error: any) {
        lastError = error;
        console.error(`Claude CLI attempt ${i + 1} failed:`, error);
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }

    throw lastError || new Error('Claude CLI failed after retries');
  }

  /**
   * Parse Claude's response
   */
  private parseAnalysisResult(result: string): AnalysisResult {
    try {
      // Try to extract JSON from response
      let jsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        jsonMatch = result.match(/```\s*([\s\S]*?)\s*```/);
      }
      if (!jsonMatch) {
        jsonMatch = result.match(/\{[\s\S]*\}/);
      }

      if (!jsonMatch) {
        console.warn('No JSON found in Claude response');
        return { libraries: [], plugins: [] };
      }

      const parsed = JSON.parse(jsonMatch[1]);

      // Validate and normalize libraries
      const libraries: LibraryDep[] = (parsed.libraries || []).map((lib: any) => ({
        name: lib.name || lib,
        version: lib.version,
        manager: this.normalizeManager(lib.manager),
      }));

      // Validate components
      const components: PluginDep[] = (parsed.components || []).filter((c: any) => {
        return c.type && c.name && ['skill', 'command', 'agent'].includes(c.type);
      });

      return { libraries, plugins: components };
    } catch (error) {
      console.error('Failed to parse Claude response:', error);
      return { libraries: [], plugins: [] };
    }
  }

  /**
   * Normalize package manager
   */
  private normalizeManager(manager: string): LibraryDep['manager'] {
    const validManagers = ['npm', 'pnpm', 'yarn', 'pip', 'poetry', 'cargo', 'go', 'composer', 'gem'];
    if (validManagers.includes(manager)) {
      return manager as LibraryDep['manager'];
    }
    // Default based on heuristics
    return 'npm';
  }
}

export const claudeDependencyAnalyzer = new ClaudeDependencyAnalyzer();
