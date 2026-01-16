import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects, agentFactoryComponents } from '@/lib/db/schema';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { eq } from 'drizzle-orm';
import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';

interface ProjectSettings {
  selectedComponents: string[];
  selectedAgentSets: string[];
}

const SETTINGS_FILE_NAME = 'project-settings.json';

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

// Helper to write settings to file
function writeSettingsFile(projectPath: string, settings: ProjectSettings): void {
  const claudeDir = join(projectPath, '.claude');
  if (!existsSync(claudeDir)) {
    require('fs').mkdirSync(claudeDir, { recursive: true });
  }

  const settingsPath = getSettingsFilePath(projectPath);
  require('fs').writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

// Helper to update .claude/config.json
function removeFromConfig(projectPath: string, componentId: string): void {
  const configPath = join(projectPath, '.claude', 'config.json');
  if (!existsSync(configPath)) return;

  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    if (Array.isArray(config.components)) {
      config.components = config.components.filter((id: string) => id !== componentId);
      require('fs').writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    }
  } catch (error) {
    console.error('Error updating config file:', error);
  }
}

// Uninstall a specific component from the project
function uninstallComponent(component: any, claudeDir: string): void {
  switch (component.type) {
    case 'skill': {
      const skillDir = join(claudeDir, 'skills', component.name);
      if (existsSync(skillDir)) {
        rmSync(skillDir, { recursive: true, force: true });
      }
      break;
    }

    case 'command': {
      // Try to find the command file
      const commandDir = join(claudeDir, 'commands');
      if (existsSync(commandDir)) {
        const fs = require('fs');
        const files = fs.readdirSync(commandDir);
        for (const file of files) {
          if (file === `${component.name}.md`) {
            rmSync(join(commandDir, file), { force: true });
            break;
          }
        }
      }
      break;
    }

    case 'agent': {
      // Try to find the agent file
      const agentDir = join(claudeDir, 'agents');
      if (existsSync(agentDir)) {
        const fs = require('fs');
        const files = fs.readdirSync(agentDir);
        for (const file of files) {
          if (file === `${component.name}.md`) {
            rmSync(join(agentDir, file), { force: true });
            break;
          }
        }
      }
      break;
    }

    case 'agent_set': {
      // Agent set: remove all components that belong to this set
      const agentSetPath = component.agentSetPath;
      if (agentSetPath && existsSync(agentSetPath)) {
        const subdirs = ['skills', 'commands', 'agents'];
        for (const subdir of subdirs) {
          const sourceSubdir = join(agentSetPath, subdir);
          if (!existsSync(sourceSubdir)) continue;

          const fs = require('fs');
          const entries = fs.readdirSync(sourceSubdir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;

            if (entry.isDirectory()) {
              // Skill directory
              const targetDir = join(claudeDir, subdir, entry.name);
              if (existsSync(targetDir)) {
                rmSync(targetDir, { recursive: true, force: true });
              }
            } else {
              // Command or agent file
              const targetPath = join(claudeDir, subdir, entry.name);
              if (existsSync(targetPath)) {
                rmSync(targetPath, { force: true });
              }
            }
          }
        }
      }
      break;
    }
  }
}

// POST /api/agent-factory/projects/[projectId]/uninstall - Uninstall a component
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const { projectId } = await params;
    const body = await request.json();
    const { componentId } = body;

    if (!componentId) {
      return NextResponse.json({ error: 'componentId is required' }, { status: 400 });
    }

    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch component details
    const component = await db
      .select()
      .from(agentFactoryComponents)
      .where(eq(agentFactoryComponents.id, componentId))
      .get();

    if (!component) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 });
    }

    // Uninstall the component from the project
    const claudeDir = join(project.path, '.claude');
    uninstallComponent(component, claudeDir);

    // Update settings - remove from selectedComponents or selectedAgentSets
    const settings = readSettingsFile(project.path);
    if (settings) {
      if (component.type === 'agent_set') {
        settings.selectedAgentSets = settings.selectedAgentSets.filter((id: string) => id !== componentId);
      } else {
        settings.selectedComponents = settings.selectedComponents.filter((id: string) => id !== componentId);
      }
      writeSettingsFile(project.path, settings);
    }

    // Update config.json
    removeFromConfig(project.path, componentId);

    return NextResponse.json({
      success: true,
      message: `Uninstalled ${component.name}`,
    });
  } catch (error) {
    console.error('Error uninstalling component:', error);
    return NextResponse.json({ error: 'Failed to uninstall component' }, { status: 500 });
  }
}
