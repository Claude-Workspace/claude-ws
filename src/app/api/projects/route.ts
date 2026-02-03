import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { nanoid } from 'nanoid';
import { desc } from 'drizzle-orm';
import { mkdir } from 'fs/promises';

// GET /api/projects - List all projects
export async function GET() {
  try {
    const projects = await db
      .select()
      .from(schema.projects)
      .orderBy(desc(schema.projects.createdAt));

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Failed to fetch projects:', error);
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
    const { name, path } = body;

    if (!name || !path) {
      return NextResponse.json(
        { error: 'Name and path are required' },
        { status: 400 }
      );
    }

    // Create the project folder
    try {
      await mkdir(path, { recursive: true });
    } catch (mkdirError: any) {
      // If folder already exists, that's okay (might be opening existing project)
      if (mkdirError?.code !== 'EEXIST') {
        console.error('Failed to create project folder:', mkdirError);
        return NextResponse.json(
          { error: 'Failed to create project folder: ' + mkdirError.message },
          { status: 500 }
        );
      }
    }

    const newProject = {
      id: nanoid(),
      name,
      path,
      createdAt: Date.now(),
    };

    await db.insert(schema.projects).values(newProject);

    return NextResponse.json(newProject, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create project:', error);

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
