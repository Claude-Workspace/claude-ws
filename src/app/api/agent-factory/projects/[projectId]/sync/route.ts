import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects, agentFactoryComponents } from '@/lib/db/schema';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { eq } from 'drizzle-orm';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, copyFileSync, writeFileSync, rmSync } from 'fs';
import { join, dirname, basename } from 'path';

interface ProjectSettings {
  selectedComponents: string[];
  selectedAgentSets: string[];
}

interface ComponentType {
  id: string;
  type: 'skill' | 'command' | 'agent' | 'agent_set';
  name: string;
  sourcePath: string | null;
  agentSetPath: string | null;
}

const SETTINGS_FILE_NAME = 'project-settings.json';

// Helper to recursively copy directory
function copyDirectory(src: string, dest: string): void {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

// Helper to get settings file path
function getSettingsFilePath(projectPath: string): string {
  return join(projectPath, '.claude', SETTINGS_FILE_NAME);
}

// Helper to read settings from file
function readSettingsFile(projectPath: string): ProjectSettings | null {
  const settingsPath = getSettingsFilePath(projectPath);
  if (!existsSync(settingsPath)) {
    return null;
  }

  try {
    const content = readFileSync(settingsPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading settings file:', error);
    return null;
  }
}

// Helper to update .claude/config.json
function updateClaudeConfig(projectPath: string, componentIds: string[]): void {
  const configPath = join(projectPath, '.claude', 'config.json');
  let config: Record<string, unknown> = {};

  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      config = JSON.parse(content);
    } catch (error) {
      console.error('Error reading config file:', error);
    }
  }

  config.components = componentIds;
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

// Check if a component's files exist in the project
function isComponentInstalled(claudeDir: string, component: ComponentType): boolean {
  switch (component.type) {
    case 'skill': {
      const skillDir = join(claudeDir, 'skills', component.name);
      return existsSync(skillDir);
    }

    case 'command': {
      const commandFile = join(claudeDir, 'commands', `${component.name}.md`);
      return existsSync(commandFile);
    }

    case 'agent': {
      const agentFile = join(claudeDir, 'agents', `${component.name}.md`);
      return existsSync(agentFile);
    }

    case 'agent_set': {
      const agentSetPath = component.agentSetPath;
      if (!agentSetPath || !existsSync(agentSetPath)) return false;

      const subdirs = ['skills', 'commands', 'agents'];
      for (const subdir of subdirs) {
        const sourceSubdir = join(agentSetPath, subdir);
        if (!existsSync(sourceSubdir)) continue;

        const entries = readdirSync(sourceSubdir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;

          const targetPath = join(claudeDir, subdir, entry.name);
          if (existsSync(targetPath)) {
            return true;
          }
        }
      }
      return false;
    }

    default:
      return false;
  }
}

// Get target directory for a component type
function getTargetDir(claudeDir: string, component: ComponentType): string {
  switch (component.type) {
    case 'skill':
      return join(claudeDir, 'skills');
    case 'command':
      return join(claudeDir, 'commands');
    case 'agent':
      return join(claudeDir, 'agents');
    case 'agent_set':
      return claudeDir; // Root .claude folder
    default:
      return join(claudeDir, 'components');
  }
}

// Install a skill (directory with SKILL.md)
function installSkill(sourcePath: string, claudeDir: string, skillName: string): void {
  const skillsDir = join(claudeDir, 'skills');
  const targetDir = join(skillsDir, skillName);

  // Remove existing if present
  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true });
  }

  mkdirSync(targetDir, { recursive: true });
  copyDirectory(sourcePath, targetDir);
}

// Install a command or agent (single file)
function installSingleFile(sourcePath: string, targetDir: string, fileName: string): void {
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  const targetPath = join(targetDir, fileName);

  // Remove existing if present
  if (existsSync(targetPath)) {
    rmSync(targetPath, { force: true });
  }

  copyFileSync(sourcePath, targetPath);
}

// Install an agent set (copy contents to appropriate folders)
function installAgentSet(agentSetPath: string, claudeDir: string): { installed: string[]; errors: string[] } {
  const installed: string[] = [];
  const errors: string[] = [];
  const subdirs = ['skills', 'commands', 'agents'];

  for (const subdir of subdirs) {
    const sourceSubdir = join(agentSetPath, subdir);
    if (!existsSync(sourceSubdir)) continue;

    const entries = readdirSync(sourceSubdir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const sourcePath = join(sourceSubdir, entry.name);
      const targetDir = join(claudeDir, subdir);

      try {
        if (entry.isDirectory()) {
          // It's a skill directory
          const targetSubDir = join(targetDir, entry.name);
          if (existsSync(targetSubDir)) {
            rmSync(targetSubDir, { recursive: true, force: true });
          }
          copyDirectory(sourcePath, targetSubDir);
          installed.push(`${subdir}/${entry.name}`);
        } else {
          // It's a command or agent file
          installSingleFile(sourcePath, targetDir, entry.name);
          installed.push(`${subdir}/${entry.name}`);
        }
      } catch (error) {
        console.error(`Error installing ${entry.name}:`, error);
        errors.push(`${subdir}/${entry.name}: ${(error as Error).message}`);
      }
    }
  }

  return { installed, errors };
}

// POST /api/agent-factory/projects/[projectId]/install - Install components to project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const { projectId } = await params;
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Read project settings
    const settings = readSettingsFile(project.path);
    if (!settings) {
      return NextResponse.json({ error: 'Project settings not found. Please configure settings first.' }, { status: 400 });
    }

    const allComponentIds = [
      ...settings.selectedComponents,
      ...settings.selectedAgentSets,
    ];

    if (allComponentIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No components selected',
        installed: [],
        skipped: [],
        errors: [],
      });
    }

    // Fetch component details
    const allComponents = await db.select().from(agentFactoryComponents);
    const selectedComponents = allComponents.filter(c => allComponentIds.includes(c.id)) as ComponentType[];

    const claudeDir = join(project.path, '.claude');

    // Ensure .claude directory exists
    if (!existsSync(claudeDir)) {
      mkdirSync(claudeDir, { recursive: true });
    }

    const installed: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    // Install each component/agent set
    for (const component of selectedComponents) {
      try {
        const sourcePath = component.type === 'agent_set'
          ? component.agentSetPath
          : component.sourcePath;

        if (!sourcePath || !existsSync(sourcePath)) {
          errors.push(`${component.name}: Source path not found`);
          continue;
        }

        // Skip if already installed
        if (isComponentInstalled(claudeDir, component)) {
          skipped.push(`${component.name}: Already installed`);
          continue;
        }

        switch (component.type) {
          case 'skill': {
            // Skills are directories, but sourcePath might point to SKILL.md file
            // If it's a file, use its parent directory
            let skillSourcePath = sourcePath;
            const stat = statSync(sourcePath);
            if (!stat.isDirectory()) {
              // sourcePath is a file (likely SKILL.md), get parent directory
              skillSourcePath = dirname(sourcePath);
            }
            installSkill(skillSourcePath, claudeDir, component.name);
            installed.push(`skill: ${component.name}`);
            break;
          }

          case 'command': {
            // Commands are files, copy to .claude/commands/{name}.md
            const commandsDir = join(claudeDir, 'commands');
            const fileName = basename(sourcePath);
            installSingleFile(sourcePath, commandsDir, fileName);
            installed.push(`command: ${component.name}`);
            break;
          }

          case 'agent': {
            // Agents are files, copy to .claude/agents/{name}.md
            const agentsDir = join(claudeDir, 'agents');
            const fileName = basename(sourcePath);
            installSingleFile(sourcePath, agentsDir, fileName);
            installed.push(`agent: ${component.name}`);
            break;
          }

          case 'agent_set': {
            // Agent sets: copy contents to appropriate folders
            const result = installAgentSet(sourcePath, claudeDir);
            installed.push(...result.installed.map(i => `agent-set: ${i}`));
            errors.push(...result.errors);
            break;
          }

          default:
            skipped.push(`${component.name}: Unknown type`);
        }
      } catch (error) {
        console.error(`Error installing component ${component.name}:`, error);
        errors.push(`${component.name}: ${(error as Error).message}`);
      }
    }

    // Update .claude/config.json
    updateClaudeConfig(project.path, allComponentIds);

    return NextResponse.json({
      success: true,
      message: `Installed ${installed.length} components to project`,
      installed,
      skipped,
      errors,
    });
  } catch (error) {
    console.error('Error installing components:', error);
    return NextResponse.json({ error: 'Failed to install components' }, { status: 500 });
  }
}
