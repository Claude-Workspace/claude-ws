/**
 * Agent Factory project sync and install service - install/uninstall plugins to project
 * .claude directories, manage project-settings.json and config.json, check installed status
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, rmSync } from 'fs';
import path from 'path';
import {
  copyDirectory,
  installSingleFile,
  installAgentSet,
  isAgentSetInstalled,
  uninstallAgentSet,
} from './agent-factory-component-install-copy-helpers.ts';

interface ProjectSettings {
  selectedComponents: string[];
  selectedAgentSets: string[];
}

interface PluginRecord {
  id: string;
  type: 'skill' | 'command' | 'agent' | 'agent_set';
  name: string;
  sourcePath: string | null;
  agentSetPath: string | null;
}

const SETTINGS_FILE_NAME = 'project-settings.json';

export function createAgentFactoryProjectSyncService() {
  return {
    /** Read project-settings.json from the project's .claude directory */
    readProjectSettings(projectPath: string): ProjectSettings | null {
      const settingsPath = path.join(projectPath, '.claude', SETTINGS_FILE_NAME);
      if (!existsSync(settingsPath)) return null;
      try {
        return JSON.parse(readFileSync(settingsPath, 'utf-8'));
      } catch {
        return null;
      }
    },

    /** Write project-settings.json to the project's .claude directory */
    writeProjectSettings(projectPath: string, settings: ProjectSettings): void {
      const claudeDir = path.join(projectPath, '.claude');
      if (!existsSync(claudeDir)) mkdirSync(claudeDir, { recursive: true });
      writeFileSync(path.join(claudeDir, SETTINGS_FILE_NAME), JSON.stringify(settings, null, 2), 'utf-8');
    },

    /** Update .claude/config.json components list */
    updateClaudeConfig(projectPath: string, componentIds: string[]): void {
      const configPath = path.join(projectPath, '.claude', 'config.json');
      let config: Record<string, unknown> = {};
      if (existsSync(configPath)) {
        try { config = JSON.parse(readFileSync(configPath, 'utf-8')); } catch { /* ignore */ }
      }
      config.components = componentIds;
      writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    },

    /** Remove a component id from .claude/config.json */
    removeFromConfig(projectPath: string, componentId: string): void {
      const configPath = path.join(projectPath, '.claude', 'config.json');
      if (!existsSync(configPath)) return;
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        if (Array.isArray(config.components)) {
          config.components = config.components.filter((id: string) => id !== componentId);
          writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        }
      } catch { /* ignore */ }
    },

    /** Check whether a component's files are already installed in the project's .claude dir */
    isComponentInstalled(claudeDir: string, component: PluginRecord): boolean {
      switch (component.type) {
        case 'skill':
          return existsSync(path.join(claudeDir, 'skills', component.name));
        case 'command':
          return existsSync(path.join(claudeDir, 'commands', `${component.name}.md`));
        case 'agent':
          return existsSync(path.join(claudeDir, 'agents', `${component.name}.md`));
        case 'agent_set':
          return component.agentSetPath
            ? isAgentSetInstalled(component.agentSetPath, claudeDir)
            : false;
        default:
          return false;
      }
    },

    /** Install a single component into the project's .claude directory */
    installComponent(component: PluginRecord, claudeDir: string): { installed: string[]; errors: string[] } {
      const installed: string[] = [];
      const errors: string[] = [];

      try {
        const sourcePath = component.type === 'agent_set' ? component.agentSetPath : component.sourcePath;
        if (!sourcePath || !existsSync(sourcePath)) {
          errors.push(`${component.name}: Source path not found`);
          return { installed, errors };
        }

        switch (component.type) {
          case 'skill': {
            let skillSrc = sourcePath;
            const stat = statSync(sourcePath);
            if (!stat.isDirectory()) skillSrc = path.dirname(sourcePath);
            const targetDir = path.join(claudeDir, 'skills', component.name);
            if (existsSync(targetDir)) rmSync(targetDir, { recursive: true, force: true });
            copyDirectory(skillSrc, targetDir);
            installed.push(`skill: ${component.name}`);
            break;
          }
          case 'command': {
            const commandsDir = path.join(claudeDir, 'commands');
            installSingleFile(sourcePath, commandsDir, path.basename(sourcePath));
            installed.push(`command: ${component.name}`);
            break;
          }
          case 'agent': {
            const agentsDir = path.join(claudeDir, 'agents');
            installSingleFile(sourcePath, agentsDir, path.basename(sourcePath));
            installed.push(`agent: ${component.name}`);
            break;
          }
          case 'agent_set': {
            const result = installAgentSet(sourcePath, claudeDir);
            installed.push(...result.installed.map(i => `agent-set: ${i}`));
            errors.push(...result.errors);
            break;
          }
        }
      } catch (err) {
        errors.push(`${component.name}: ${(err as Error).message}`);
      }

      return { installed, errors };
    },

    /** Uninstall a component from the project's .claude directory */
    uninstallComponent(component: PluginRecord, claudeDir: string): void {
      switch (component.type) {
        case 'skill': {
          const skillDir = path.join(claudeDir, 'skills', component.name);
          if (existsSync(skillDir)) rmSync(skillDir, { recursive: true, force: true });
          break;
        }
        case 'command': {
          const commandFile = path.join(claudeDir, 'commands', `${component.name}.md`);
          if (existsSync(commandFile)) rmSync(commandFile, { force: true });
          break;
        }
        case 'agent': {
          const agentFile = path.join(claudeDir, 'agents', `${component.name}.md`);
          if (existsSync(agentFile)) rmSync(agentFile, { force: true });
          break;
        }
        case 'agent_set': {
          if (component.agentSetPath) {
            uninstallAgentSet(component.agentSetPath, claudeDir);
          }
          break;
        }
      }
    },
  };
}
