import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { nanoid } from 'nanoid';
import { desc } from 'drizzle-orm';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { setupProjectDefaults } from '@/lib/project-utils';
import { createLogger } from '@/lib/logger';

const log = createLogger('Projects');

// GET /api/projects - List all projects
export async function GET() {
  try {
    const projects = await db
      .select()
      .from(schema.projects)
      .orderBy(desc(schema.projects.createdAt));

    return NextResponse.json(projects);
  } catch (error) {
    log.error({ error }, 'Failed to fetch projects');
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, path: inputPath } = body;

    if (!name || !inputPath) {
      return NextResponse.json(
        { error: 'Name and path are required' },
        { status: 400 }
      );
    }

    // If path is not absolute (just a roomId or project name), construct full path
    let projectPath = inputPath;
    let projectId;

    if (!inputPath.startsWith('/')) {
      // Path is relative, use inputPath as projectId and construct full path: data/projects/{projectId}-{name}
      projectId = inputPath; // Use the roomId sent by client as projectId
      const sanitizedProjectName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const projectDirName = `${projectId}-${sanitizedProjectName}`;
      projectPath = join(process.cwd(), 'data', 'projects', projectDirName);
      log.info({ inputPath, projectPath, projectId, name }, '[Projects] Constructed full project path from relative path');
    } else {
      // Path is absolute, generate new projectId
      projectId = nanoid();
    }

    // Create the project folder
    try {
      await mkdir(projectPath, { recursive: true });
    } catch (mkdirError: any) {
      // If folder already exists, that's okay (might be opening existing project)
      if (mkdirError?.code !== 'EEXIST') {
        log.error({ error: mkdirError }, 'Failed to create project folder');
        return NextResponse.json(
          { error: 'Failed to create project folder: ' + mkdirError.message },
          { status: 500 }
        );
      }
    }

    const newProject = {
      id: projectId,
      name,
      path: projectPath,
      createdAt: Date.now(),
    };

    // Generate default .claude folder, hooks, settings, and CLAUDE.md
    await setupProjectDefaults(projectPath, newProject.id);

    await db.insert(schema.projects).values(newProject);

    return NextResponse.json(newProject, { status: 201 });
  } catch (error: any) {
    log.error({ error }, 'Failed to create project');

    // Handle unique constraint violation (duplicate path)
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return NextResponse.json(
        { error: 'A project with this path already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
