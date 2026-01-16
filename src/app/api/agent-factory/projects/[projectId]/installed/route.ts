import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects, agentFactoryPlugins } from '@/lib/db/schema';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { eq } from 'drizzle-orm';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface ProjectSettings {
  selectedComponents: string[];
  selectedAgentSets: string[];
}

const SETTINGS_FILE_NAME = 'project-settings.json';

function getSettingsFilePath(projectPath: string): string {
  return join(projectPath, '.claude', SETTINGS_FILE_NAME);
}

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

// Check if a component's files exist in the project
function isComponentInstalled(projectPath: string, component: any): boolean {
  const claudeDir = join(projectPath, '.claude');

  switch (component.type) {
    case 'skill': {
      // Check if skill directory exists
      const skillDir = join(claudeDir, 'skills', component.name);
      return existsSync(skillDir);
    }

    case 'command': {
      // Check if command file exists
      const commandFile = join(claudeDir, 'commands', `${component.name}.md`);
      return existsSync(commandFile);
    }

    case 'agent': {
      // Check if agent file exists
      const agentFile = join(claudeDir, 'agents', `${component.name}.md`);
      return existsSync(agentFile);
    }

    case 'agent_set': {
      // Check if any files from agent set exist
      const agentSetPath = component.agentSetPath;
      if (!agentSetPath || !existsSync(agentSetPath)) return false;

      // Check if any subdirectories have content in the project
      const subdirs = ['skills', 'commands', 'agents'];
      for (const subdir of subdirs) {
        const sourceSubdir = join(agentSetPath, subdir);
        if (!existsSync(sourceSubdir)) continue;

        const entries = require('fs').readdirSync(sourceSubdir, { withFileTypes: true });
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

// GET /api/agent-factory/projects/[projectId]/installed - Get installed components
export async function GET(
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
    const allComponentIds = settings
      ? [...settings.selectedComponents, ...settings.selectedAgentSets]
      : [];

    if (allComponentIds.length === 0) {
      return NextResponse.json({ installed: [] });
    }

    // Fetch all components
    const allComponents = await db.select().from(agentFactoryPlugins);
    const selectedComponents = allComponents.filter(c => allComponentIds.includes(c.id));

    // Check which are installed
    const installed = selectedComponents
      .filter(c => isComponentInstalled(project.path, c))
      .map(c => c.id);

    return NextResponse.json({ installed });
  } catch (error) {
    console.error('Error checking installed components:', error);
    return NextResponse.json({ error: 'Failed to check installed components' }, { status: 500 });
  }
}
