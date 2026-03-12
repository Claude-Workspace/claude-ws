import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { createLogger } from './logger';
import { analyzePackageFiles } from './dependency-extractor-package-file-parsers';

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
 * Extracts library and component dependencies from source code.
 * Uses regex-based extraction with support for multiple languages.
 */
export class DependencyExtractor {
  async extract(sourcePath: string, type: string): Promise<ExtractedDeps> {
    try {
      if (!existsSync(sourcePath)) return { libraries: [], plugins: [] };

      const isDirectory = type === 'skill';
      const files: string[] = [];

      if (isDirectory) {
        await this.collectSourceFiles(sourcePath, files);
      } else {
        files.push(sourcePath);
      }

      const libraries = new Map<string, LibraryDep>();
      const plugins: PluginDep[] = [];

      for (const filePath of files) {
        await this.analyzeFile(filePath, libraries, plugins);
      }

      if (isDirectory) {
        await analyzePackageFiles(sourcePath, libraries);
      }

      return { libraries: Array.from(libraries.values()), plugins };
    } catch (error) {
      log.error({ error }, 'Error extracting dependencies:');
      return { libraries: [], plugins: [] };
    }
  }

  private async collectSourceFiles(dir: string, files: string[]): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name.startsWith('mod')) continue;
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await this.collectSourceFiles(fullPath, files);
        } else if (entry.isFile() && this.isSourceFile(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  private isSourceFile(filename: string): boolean {
    const sourceExtensions = [
      '.ts', '.tsx', '.js', '.jsx',
      '.py', '.go', '.rs',
      '.java', '.kt', '.cs',
      '.rb', '.php', '.swift',
    ];
    return sourceExtensions.some(ext => filename.endsWith(ext));
  }

  private async analyzeFile(
    filePath: string,
    libraries: Map<string, LibraryDep>,
    plugins: PluginDep[]
  ): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const ext = filePath.split('.').pop() || '';
      const manager = this.inferManagerFromExtension(ext);
      this.extractLibraries(content, libraries, manager);
      this.extractComponents(content, plugins);
    } catch {
      // Skip unreadable files
    }
  }

  private extractLibraries(
    content: string,
    libraries: Map<string, LibraryDep>,
    defaultManager: LibraryDep['manager']
  ): void {
    const patterns = [
      /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g,
      /require\(['"]([^'"]+)['"]\)/g,
      /^from\s+(\S+)\s+import/gm,
      /^import\s+(\S+)/gm,
      /import\s+(?:(?:"([^"]+)"|'([^']+)')|(\w+\s+"([^"]+)"))/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        let dep = match[1] || match[2] || match[3] || match[4] || '';
        if (!dep) continue;
        if (dep.startsWith('.') || dep.startsWith('/')) continue;

        dep = dep.split('/')[0].replace('@', '');
        const manager = dep.startsWith('@') ? 'npm' : defaultManager;
        const key = `${manager}:${dep}`;
        if (!libraries.has(key)) libraries.set(key, { name: dep, manager });
      }
    }
  }

  private extractComponents(content: string, plugins: PluginDep[]): void {
    const patterns = [
      /skill:\s*['"]([^'"]+)['"]/gi,
      /command:\s*['"]([^'"]+)['"]/gi,
      /agent:\s*['"]([^'"]+)['"]/gi,
      /use(Skill|Command|Agent)\(['"]([^'"]+)['"]\)/g,
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
        if (!seen.has(key)) { seen.add(key); plugins.push({ type, name }); }
      }
    }
  }

  private inferManagerFromExtension(ext: string): LibraryDep['manager'] {
    const managerMap: Record<string, LibraryDep['manager']> = {
      ts: 'npm', tsx: 'npm', js: 'npm', jsx: 'npm',
      py: 'pip', go: 'go', rs: 'cargo',
      java: 'composer', kt: 'composer', cs: 'composer',
      rb: 'gem', php: 'composer', swift: 'composer',
    };
    return managerMap[ext] || 'npm';
  }
}

export const dependencyExtractor = new DependencyExtractor();
