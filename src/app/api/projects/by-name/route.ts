import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { nanoid } from 'nanoid';
import { mkdir, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { userInfo } from 'os';
import { createLogger } from '@/lib/logger';
import { getUniqueProjectPath, setupProjectDefaults } from '@/lib/project-utils';

const log = createLogger('ProjectsByName');

// POST /api/projects/by-name - Create a new project by name
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name } = body;

        if (!name || typeof name !== 'string' || !name.trim()) {
            return NextResponse.json(
                { error: 'Project name is required' },
                { status: 400 }
            );
        }

        // Determine the base directory: /home/{user}/cloude-project
        let username = 'default-user';
        try {
            username = userInfo().username;
        } catch (e) {
            log.warn('Could not determine OS username, fallback to default-user');
        }

        // Usually '/home' on Linux/macOS, but joining makes it cross-compatible
        // To strictly follow the plan on Linux:
        const baseDir = join('/home', username, 'claude-project');

        // Ensure the base directory exists
        try {
            await mkdir(baseDir, { recursive: true });
        } catch (mkdirError: any) {
            if (mkdirError?.code !== 'EEXIST') {
                log.error({ error: mkdirError }, 'Failed to create base project folder');
                return NextResponse.json(
                    { error: 'Failed to create base project folder: ' + mkdirError.message },
                    { status: 500 }
                );
            }
        }

        // Get a unique project path
        const projectPath = await getUniqueProjectPath(baseDir, name);

        // Create the actual project folder
        try {
            await mkdir(projectPath, { recursive: true });
        } catch (mkdirError: any) {
            log.error({ error: mkdirError }, 'Failed to create project folder');
            return NextResponse.json(
                { error: 'Failed to create project folder: ' + mkdirError.message },
                { status: 500 }
            );
        }

        const newProject = {
            id: nanoid(),
            name: name.trim(),  // Store the original requested name or the sanitized one as you prefer.
            path: projectPath,
            createdAt: Date.now(),
        };

        // Generate default .claude folder, hooks, settings, and CLAUDE.md
        await setupProjectDefaults(projectPath, newProject.id);

        // Insert into DB
        await db.insert(schema.projects).values(newProject);

        return NextResponse.json(newProject, { status: 201 });
    } catch (error: any) {
        log.error({ error }, 'Failed to create project by name');

        // Handle unique constraint violation (duplicate path) - unlikely but possible
        if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return NextResponse.json(
                { error: 'A project with this path already exists in the database' },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to create project' },
            { status: 500 }
        );
    }
}
