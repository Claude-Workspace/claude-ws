import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

import { createLogger } from './logger';

const log = createLogger('DependencyExtractor');

export interface LibraryDep {
  name: string;
  version?: string;
  manager: 'npm' | 'pnpm' | 'yarn' | 'pip' | 'poetry' | 'cargo' | 'go' | 'composer' | 'gem';
}

export interface PluginDep {
  type: 'skill' | 'command' | 'agent';
  name: string;
}

export interface ExtractedDeps {
  libraries: LibraryDep[];
  plugins: PluginDep[];
}

/**
 * Dependency Extractor Service
 * Extracts library and component dependencies from source code
 * Uses regex-based extraction with support for multiple languages
 */
export class DependencyExtractor {
  /**
   * Extract dependencies from a component source
   */
  async extract(sourcePath: string, type: string): Promise<ExtractedDeps> {
    try {
      // Check if source exists
      if (!existsSync(sourcePath)) {
        return { libraries: [], plugins: [] };
      }

      const isDirectory = type === 'skill';
      const files: string[] = [];

      if (isDirectory) {
        await this.collectSourceFiles(sourcePath, files);
      } else {
        files.push(sourcePath);
      }

      const libraries = new Map<string, LibraryDep>();
      const plugins: PluginDep[] = [];

      // Analyze each file
      for (const filePath of files) {
        await this.analyzeFile(filePath, libraries, plugins);
      }

      // Check for package manager files (package.json, requirements.txt, etc.)
      if (isDirectory) {
        await this.analyzePackageFiles(sourcePath, libraries);
      }

      return {
        libraries: Array.from(libraries.values()),
        plugins
      };
    } catch (error) {
      log.error({ error: error }, 'Error extracting dependencies:');
      return { libraries: [], plugins: [] };
    }
  }

  /**
   * Collect all source files from a directory
   */
  private async collectSourceFiles(dir: string, files: string[]): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name.startsWith('mod')) {
          continue;
        }
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await this.collectSourceFiles(fullPath, files);
        } else if (entry.isFile() && this.isSourceFile(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  /**
   * Check if a file is a source file we should analyze
   */
  private isSourceFile(filename: string): boolean {
    const sourceExtensions = [
      '.ts', '.tsx', '.js', '.jsx',  // JavaScript/TypeScript
      '.py',                           // Python
      '.go',                           // Go
      '.rs',                           // Rust
      '.java', '.kt', '.cs',           // Java/Kotlin/C#
      '.rb',                           // Ruby
      '.php',                          // PHP
      '.swift',                        // Swift
    ];
    return sourceExtensions.some(ext => filename.endsWith(ext));
  }

  /**
   * Analyze a single file for dependencies
   */
  private async analyzeFile(
    filePath: string,
    libraries: Map<string, LibraryDep>,
    plugins: PluginDep[]
  ): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const ext = filePath.split('.').pop() || '';
      const manager = this.inferManagerFromExtension(ext);

      // Extract library dependencies
      this.extractLibraries(content, libraries, manager);

      // Extract plugin dependencies
      this.extractComponents(content, plugins);
    } catch {
      // Skip files we can't read
    }
  }

  /**
   * Extract library dependencies from content
   */
  private extractLibraries(
    content: string,
    libraries: Map<string, LibraryDep>,
    defaultManager: LibraryDep['manager']
  ): void {
    // Import/require patterns
    const patterns = [
      // ES6 imports
      /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g,
      // CommonJS require
      /require\(['"]([^'"]+)['"]\)/g,
      // Python imports
      /^from\s+(\S+)\s+import/gm,
      /^import\s+(\S+)/gm,
      // Go imports
      /import\s+(?:(?:"([^"]+)"|'([^']+)')|(\w+\s+"([^"]+)"))/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        // Find the actual import path in the match groups
        let dep = match[1] || match[2] || match[3] || match[4] || '';
        if (!dep) continue;

        // Skip relative imports
        if (dep.startsWith('.') || dep.startsWith('/')) continue;

        // Clean up the dependency name
        dep = dep.split('/')[0].replace('@', ''); // Get scope if npm

        // Determine the manager
        let manager = defaultManager;
        if (dep.startsWith('@')) {
          manager = 'npm';
        }

        const key = `${manager}:${dep}`;
        if (!libraries.has(key)) {
          libraries.set(key, {
            name: dep,
            manager
          });
        }
      }
    }
  }

  /**
   * Extract component dependencies from content
   */
  private extractComponents(content: string, plugins: PluginDep[]): void {
    // Look for skill/command/agent references
    const patterns = [
      // skill: "name" or skill: 'name'
      /skill:\s*['"]([^'"]+)['"]/gi,
      // command: "name" or command: 'name'
      /command:\s*['"]([^'"]+)['"]/gi,
      // agent: "name" or agent: 'name'
      /agent:\s*['"]([^'"]+)['"]/gi,
      // useSkill('name'), useCommand('name'), useAgent('name')
      /use(Skill|Command|Agent)\(['"]([^'"]+)['"]\)/g,
      // /skill:name or /command:name or /agent:name (for CLI-like usage)
      /\/(skill|command|agent):([a-zA-Z0-9_-]+)/g,
    ];

    const seen = new Set<string>();

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        let type: 'skill' | 'command' | 'agent' | undefined;
        let name = '';

        if (match[1] && ['skill', 'command', 'agent'].includes(match[1].toLowerCase())) {
          type = match[1].toLowerCase() as 'skill' | 'command' | 'agent';
          name = match[2];
        } else if (match[3] && ['skill', 'command', 'agent'].includes(match[3].toLowerCase())) {
          type = match[3].toLowerCase() as 'skill' | 'command' | 'agent';
          name = match[4];
        } else if (match[5] && ['skill', 'command', 'agent'].includes(match[5].toLowerCase())) {
          type = match[5].toLowerCase() as 'skill' | 'command' | 'agent';
          name = match[6];
        }

        if (!type || !name) continue;

        const key = `${type}:${name}`;
        if (!seen.has(key)) {
          seen.add(key);
          plugins.push({ type, name });
        }
      }
    }
  }

  /**
   * Analyze package manager files (package.json, requirements.txt, etc.)
   */
  private async analyzePackageFiles(
    sourcePath: string,
    libraries: Map<string, LibraryDep>
  ): Promise<void> {
    // package.json
    const packageJsonPath = join(sourcePath, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const content = await readFile(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(content);

        if (pkg.dependencies) {
          for (const [name, version] of Object.entries(pkg.dependencies)) {
            libraries.set(`npm:${name}`, {
              name,
              version: version as string,
              manager: 'npm'
            });
          }
        }

        if (pkg.devDependencies) {
          for (const [name, version] of Object.entries(pkg.devDependencies)) {
            const key = `npm:${name}`;
            if (!libraries.has(key)) {
              libraries.set(key, {
                name,
                version: version as string,
                manager: 'npm'
              });
            }
          }
        }
      } catch {
        // Invalid package.json, skip
      }
    }

    // requirements.txt
    const requirementsPath = join(sourcePath, 'requirements.txt');
    if (existsSync(requirementsPath)) {
      try {
        const content = await readFile(requirementsPath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;

          // Parse requirement: package==version or package>=version
          const match = trimmed.match(/^([a-zA-Z0-9_-]+)([~>=<!]+)?(.+)?/);
          if (match) {
            libraries.set(`pip:${match[1]}`, {
              name: match[1],
              version: match[2] && match[3] ? `${match[2]}${match[3]}` : undefined,
              manager: 'pip'
            });
          }
        }
      } catch {
        // Invalid requirements.txt, skip
      }
    }

    // go.mod
    const goModPath = join(sourcePath, 'go.mod');
    if (existsSync(goModPath)) {
      try {
        const content = await readFile(goModPath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('require ')) {
            const match = trimmed.match(/require\s+(\S+)\s+(.+)?/);
            if (match) {
              libraries.set(`go:${match[1]}`, {
                name: match[1],
                version: match[2],
                manager: 'go'
              });
            }
          }
        }
      } catch {
        // Invalid go.mod, skip
      }
    }

    // Cargo.toml
    const cargoPath = join(sourcePath, 'Cargo.toml');
    if (existsSync(cargoPath)) {
      try {
        const content = await readFile(cargoPath, 'utf-8');

        // Parse [dependencies] section
        const depsMatch = content.match(/\[dependencies\]([\s\S]*?)(?=\[|$)/);
        if (depsMatch) {
          const lines = depsMatch[1].split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            const match = trimmed.match(/^(\w+)(\s*=\s*)?(.+)?/);
            if (match) {
              libraries.set(`cargo:${match[1]}`, {
                name: match[1],
                version: match[3],
                manager: 'cargo'
              });
            }
          }
        }
      } catch {
        // Invalid Cargo.toml, skip
      }
    }
  }

  /**
   * Infer package manager from file extension
   */
  private inferManagerFromExtension(ext: string): LibraryDep['manager'] {
    const managerMap: Record<string, LibraryDep['manager']> = {
      'ts': 'npm',
      'tsx': 'npm',
      'js': 'npm',
      'jsx': 'npm',
      'py': 'pip',
      'go': 'go',
      'rs': 'cargo',
      'java': 'composer',
      'kt': 'composer',
      'cs': 'composer',
      'rb': 'gem',
      'php': 'composer',
      'swift': 'composer',
    };
    return managerMap[ext] || 'npm';
  }
}

export const dependencyExtractor = new DependencyExtractor();
