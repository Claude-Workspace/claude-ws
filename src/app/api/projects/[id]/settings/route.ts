import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { eq } from 'drizzle-orm';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, copyFileSync } from 'fs';
import { join } from 'path';
import { createLogger } from '@/lib/logger';

const log = createLogger('ProjectSettings');

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
    log.error({ error, settingsPath }, 'Error reading settings file');
    return null;
  }
}

// Helper to write settings to file
function writeSettingsFile(projectPath: string, settings: ProjectSettings): void {
  const claudeDir = join(projectPath, '.claude');

  // Create .claude directory if it doesn't exist
  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }

  const settingsPath = getSettingsFilePath(projectPath);
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

// GET /api/projects/[id]/settings - Fetch project settings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .get();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const settings = readSettingsFile(project.path);

    if (!settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    log.error({ error }, 'Error fetching project settings');
    return NextResponse.json({ error: 'Failed to fetch project settings' }, { status: 500 });
  }
}

// POST /api/projects/[id]/settings - Update project settings
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .get();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const { settings } = body;

    if (!settings) {
      return NextResponse.json({ error: 'Missing settings in request body' }, { status: 400 });
    }

    // Validate settings structure
    const newSettings: ProjectSettings = {
      selectedComponents: settings.selectedComponents || [],
      selectedAgentSets: settings.selectedAgentSets || [],
    };

    // Write settings to file
    writeSettingsFile(project.path, newSettings);

    return NextResponse.json({ settings: newSettings });
  } catch (error) {
    log.error({ error }, 'Error updating project settings');
    return NextResponse.json({ error: 'Failed to update project settings' }, { status: 500 });
  }
}
