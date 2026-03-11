/**
 * Agent Factory plugin filesystem service - file tree listing, file read/write,
 * and plugin directory operations. Component discovery is delegated to
 * agent-factory-component-discovery-service.
 */
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';
import { discoverComponents, type DiscoveredItem, type DiscoveredFolder } from './agent-factory-component-discovery-service';

export type { DiscoveredItem, DiscoveredFolder };

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export function createAgentFactoryFilesystemService() {
  return {
    /** Build a recursive file tree for a plugin directory, sorted dirs-first */
    async buildPluginFileTree(dirPath: string, relativePath = ''): Promise<FileNode[]> {
      const fullPath = path.join(dirPath, relativePath);
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const nodes: FileNode[] = [];

      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const entryPath = path.join(relativePath, entry.name);
        const node: FileNode = {
          name: entry.name,
          path: entryPath,
          type: entry.isDirectory() ? 'directory' : 'file',
        };
        if (entry.isDirectory()) {
          node.children = await this.buildPluginFileTree(dirPath, entryPath);
        }
        nodes.push(node);
      }

      return nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    },

    /** List files for a plugin based on its type and paths */
    async listPluginFiles(plugin: {
      type: string;
      sourcePath: string | null;
      agentSetPath?: string | null;
    }): Promise<{ files: FileNode[]; error?: string }> {
      const pluginPath = plugin.type === 'agent_set' ? plugin.agentSetPath : plugin.sourcePath;
      if (!pluginPath) return { files: [], error: 'Plugin path not found' };

      if (plugin.type === 'skill') {
        // sourcePath points to SKILL.md; list parent directory
        const skillDir = path.dirname(pluginPath);
        if (!existsSync(skillDir)) return { files: [], error: 'Skill directory not found' };
        return { files: await this.buildPluginFileTree(skillDir, '') };
      }

      if (plugin.type === 'agent_set') {
        if (!existsSync(pluginPath)) return { files: [], error: 'Agent set directory not found' };
        return { files: await this.buildPluginFileTree(pluginPath, '') };
      }

      // command / agent: single file
      if (!existsSync(pluginPath)) return { files: [], error: 'Plugin file not found' };
      const fileName = pluginPath.split('/').pop()!;
      return { files: [{ name: fileName, path: fileName, type: 'file' }] };
    },

    /** Read a specific file from a plugin's directory, with security check */
    async readPluginFile(plugin: {
      type: string;
      sourcePath: string | null;
      agentSetPath?: string | null;
    }, fileParts: string[]): Promise<{ content: string; language: string; name: string; path: string; size: number } | { error: string; status: number }> {
      const homeDir = homedir();

      let filePath: string;
      if (plugin.type === 'skill') {
        const skillDir = path.dirname(plugin.sourcePath!);
        filePath = path.join(skillDir, ...fileParts);
      } else if (plugin.type === 'agent_set') {
        filePath = path.join(plugin.agentSetPath!, ...fileParts);
      } else {
        // command/agent: use sourcePath directly
        filePath = plugin.sourcePath!;
      }

      // Security check
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(homeDir)) return { error: 'Access denied', status: 403 };
      if (!existsSync(filePath)) return { error: 'File not found', status: 404 };

      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) return { error: 'Is a directory', status: 400 };

      const content = await fs.readFile(filePath, 'utf-8');
      const ext = fileParts[fileParts.length - 1]?.split('.').pop() || '';
      return {
        name: fileParts[fileParts.length - 1],
        path: fileParts.join('/'),
        content,
        language: getLanguageFromExtension(ext),
        size: stats.size,
      };
    },

    /** Save a file within a plugin's directory, with security check */
    async savePluginFile(plugin: {
      type: string;
      sourcePath: string | null;
      agentSetPath?: string | null;
      storageType: string;
    }, filePath: string, content: string): Promise<{ success: boolean } | { error: string; status: number }> {
      if (plugin.storageType !== 'local') {
        return { error: 'Only local components can be edited', status: 403 };
      }

      const basePath = plugin.type === 'agent_set' ? plugin.agentSetPath : plugin.sourcePath;
      if (!basePath) return { error: 'Component path not found', status: 404 };

      let fullPath: string;
      if (plugin.type === 'skill') {
        fullPath = path.join(path.dirname(plugin.sourcePath!), filePath);
      } else if (plugin.type === 'agent_set') {
        fullPath = path.join(basePath, filePath);
      } else {
        fullPath = plugin.sourcePath!;
      }

      const resolved = path.resolve(fullPath);
      const pluginBaseDir = path.resolve(path.dirname(basePath));
      if (!resolved.startsWith(pluginBaseDir + path.sep) && resolved !== pluginBaseDir) {
        return { error: 'Access denied: path outside plugin directory', status: 403 };
      }
      if (!resolved.startsWith(homedir())) {
        return { error: 'Access denied', status: 403 };
      }

      const dirPath = path.dirname(fullPath);
      if (!existsSync(dirPath)) {
        await fs.mkdir(dirPath, { recursive: true });
      }

      await fs.writeFile(fullPath, content, 'utf-8');
      return { success: true };
    },

    /** List files from an arbitrary source path (for discovered components), with home-dir security check */
    async listSourcePathFiles(sourcePath: string, type: 'skill' | 'command' | 'agent'): Promise<{ files: FileNode[] } | { error: string; status: number }> {
      const resolved = path.resolve(sourcePath);
      if (!resolved.startsWith(homedir())) return { error: 'Access denied', status: 403 };
      if (!existsSync(sourcePath)) return { error: 'Source path not found', status: 404 };

      if (type === 'skill') {
        return { files: await this.buildPluginFileTree(sourcePath, '') };
      }
      // commands/agents: single file
      const fileName = sourcePath.split('/').pop()!;
      return { files: [{ name: fileName, path: fileName, type: 'file' }] };
    },

    /** Read file content from a basePath + filePath, with home-dir security check */
    async readSourceFileContent(basePath: string, filePath: string): Promise<{ name: string; path: string; content: string; language: string; size: number } | { error: string; status: number }> {
      let fullPath: string;
      try {
        const stats = await fs.stat(basePath);
        fullPath = stats.isFile() ? basePath : path.join(basePath, filePath);
      } catch {
        return { error: 'File not found', status: 404 };
      }

      const resolved = path.resolve(fullPath);
      if (!resolved.startsWith(homedir())) return { error: 'Access denied', status: 403 };
      if (!existsSync(fullPath)) return { error: 'File not found', status: 404 };

      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) return { error: 'Is a directory', status: 400 };

      const content = await fs.readFile(fullPath, 'utf-8');
      const ext = filePath.split('.').pop() || '';
      return {
        name: filePath.split('/').pop() || filePath,
        path: filePath,
        content,
        language: getLanguageFromExtension(ext),
        size: stats.size,
      };
    },

    /** Scan the home directory for skill/command/agent components, building folder hierarchy */
    async discoverComponents(excludeDir: string): Promise<Array<DiscoveredFolder | DiscoveredItem>> {
      return discoverComponents(excludeDir);
    },

    /** Compare discovered components against imported ones by file modification time */
    async compareWithImported(
      discovered: Array<{ type: string; name: string; description?: string; sourcePath: string; metadata?: Record<string, unknown> }>,
      imported: Array<{ id: string; type: string; name: string; sourcePath: string | null; updatedAt: number }>
    ) {
      const result: Array<typeof discovered[number] & { status: 'new' | 'update' | 'current'; existingPlugin?: { id: string; sourcePath: string | null; updatedAt: number } }> = [];

      for (const comp of discovered) {
        const existing = imported.find(c => c.type === comp.type && c.name === comp.name);
        if (!existing) { result.push({ ...comp, status: 'new' }); continue; }

        const sourceExists = comp.sourcePath && existsSync(comp.sourcePath);
        const importedExists = existing.sourcePath && existsSync(existing.sourcePath);

        if (!sourceExists || !importedExists) { result.push({ ...comp, status: 'new' }); continue; }

        try {
          const srcMtime = (await fs.stat(comp.sourcePath)).mtimeMs;
          const impMtime = (await fs.stat(existing.sourcePath!)).mtimeMs;
          result.push({
            ...comp,
            status: srcMtime > impMtime ? 'update' : 'current',
            existingPlugin: { id: existing.id, sourcePath: existing.sourcePath, updatedAt: existing.updatedAt },
          });
        } catch {
          result.push({ ...comp, status: 'new' });
        }
      }

      return result;
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getLanguageFromExtension(ext: string): string {
  const langMap: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    c: 'c', cpp: 'cpp', cs: 'csharp', php: 'php', swift: 'swift', kt: 'kotlin',
    sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash', sql: 'sql',
    json: 'json', yaml: 'yaml', yml: 'yaml', xml: 'xml', html: 'html',
    htm: 'html', css: 'css', scss: 'scss', sass: 'sass', less: 'less',
    md: 'markdown', markdown: 'markdown', txt: 'text', toml: 'toml',
    ini: 'ini', cfg: 'ini', dockerfile: 'dockerfile', docker: 'dockerfile',
    makefile: 'makefile', cmake: 'cmake',
  };
  return langMap[ext.toLowerCase()] || 'text';
}
