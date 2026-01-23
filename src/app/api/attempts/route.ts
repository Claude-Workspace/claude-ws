import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { nanoid } from 'nanoid';
import { eq, and, desc, asc } from 'drizzle-orm';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { formatOutput } from '@/lib/output-formatter';
import { waitForAttemptCompletion, AttemptTimeoutError } from '@/lib/attempt-waiter';
import type { ClaudeOutput, OutputFormat, RequestMethod } from '@/types';

// POST /api/attempts - Create a new attempt (only creates record)
// Actual execution happens via WebSocket
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      taskId,
      prompt,
      force_create,
      projectId,
      projectName,
      taskTitle,
      projectRootPath,
      request_method = 'queue',
      output_format,
      output_schema,
      timeout
    } = body;

    console.log('POST /api/attempts received:', {
      taskId,
      prompt,
      force_create,
      projectId,
      projectName,
      taskTitle,
      projectRootPath,
      request_method,
      output_format,
      timeout
    });

    // Validate request_method
    if (request_method && request_method !== 'sync' && request_method !== 'queue') {
      return NextResponse.json(
        { error: 'Invalid request_method. Must be "sync" or "queue"' },
        { status: 400 }
      );
    }

    // Validate output_format
    const validFormats: OutputFormat[] = ['json', 'html', 'markdown', 'yaml', 'raw', 'custom'];
    if (output_format && !validFormats.includes(output_format)) {
      return NextResponse.json(
        { error: `Invalid output_format. Must be one of: ${validFormats.join(', ')}` },
        { status: 400 }
      );
    }

    // For custom format, output_schema is required
    if (output_format === 'custom' && !output_schema) {
      return NextResponse.json(
        { error: 'output_schema is required when output_format is "custom"' },
        { status: 400 }
      );
    }

    if (!taskId || !prompt) {
      return NextResponse.json(
        { error: 'taskId and prompt are required' },
        { status: 400 }
      );
    }

    // Prepare prompt with schema instructions for custom format
    let finalPrompt = prompt;
    if (output_format === 'custom' && output_schema) {
      finalPrompt = `${output_schema}\n\n${prompt}`;
    }

    // Step 1: If force_create is not true, skip validation and create attempt directly
    if (!force_create) {
      // Validate task exists (current behavior)
      const task = await db.query.tasks.findFirst({
        where: eq(schema.tasks.id, taskId)
      });

      if (!task) {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        );
      }

      // Create attempt with existing task
      return await createAttempt(
        task,
        finalPrompt,
        request_method,
        output_format,
        output_schema,
        timeout
      );
    }

    // Step 2: Check if taskId exists
    const existingTask = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, taskId)
    });

    if (existingTask) {
      // Task exists, create attempt directly
      return await createAttempt(
        existingTask,
        finalPrompt,
        request_method,
        output_format,
        output_schema,
        timeout
      );
    }

    // Step 3: Task doesn't exist, need to validate and create
    // First, get the projectId from the request body
    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId required' },
        { status: 400 }
      );
    }

    // Step 4: Check if projectId exists
    let existingProject;
    try {
      existingProject = await db.query.projects.findFirst({
        where: eq(schema.projects.id, projectId)
      });
    } catch (dbError) {
      console.error('Database error checking project:', dbError);
      return NextResponse.json(
        { error: 'Database error checking project' },
        { status: 500 }
      );
    }

    console.log('Project exists?', !!existingProject);

    let finalProjectId = projectId;

    if (!existingProject) {
      console.log('Project does not exist, checking projectName...');
      console.log('projectName value:', projectName);
      console.log('projectName type:', typeof projectName);
      console.log('projectName === undefined:', projectName === undefined);
      console.log('projectName === null:', projectName === null);
      console.log('projectName === "":', projectName === "");

      // Project doesn't exist, check if projectName provided
      if (!projectName || projectName.trim() === '') {
        console.log('Project name required but not provided');
        return NextResponse.json(
          { error: 'projectName required' },
          { status: 400 }
        );
      }

      // Determine project path based on projectRootPath
      const projectDirName = `${projectId}-${projectName}`;
      const projectPath = projectRootPath
        ? join(projectRootPath, projectDirName)
        : join(homedir(), '.claude-ws', 'projects', projectDirName);

      // Create the project folder
      try {
        await mkdir(projectPath, { recursive: true });
      } catch (mkdirError: any) {
        // If folder already exists, that's okay
        if (mkdirError?.code !== 'EEXIST') {
          console.error('Failed to create project folder:', mkdirError);
          return NextResponse.json(
            { error: 'Failed to create project folder: ' + mkdirError.message },
            { status: 500 }
          );
        }
      }

      // Create new project
      const newProject = {
        id: projectId,
        name: projectName,
        path: projectPath,
        createdAt: Date.now(),
      };

      try {
        await db.insert(schema.projects).values(newProject);
      } catch (error) {
        console.error('Failed to create project:', error);
        return NextResponse.json(
          { error: 'Failed to create project' },
          { status: 500 }
        );
      }
    }

    // Step 5: At this point, project exists (either was existing or was just created)
    // Check if taskTitle is provided
    if (!taskTitle || taskTitle.trim() === '') {
      console.log('Task title required but not provided');
      return NextResponse.json(
        { error: 'taskTitle required' },
        { status: 400 }
      );
    }

    // Create new task
    const newTask = await createNewTask(taskId, finalProjectId, taskTitle);

    if (!newTask) {
      return NextResponse.json(
        { error: 'Failed to create task' },
        { status: 500 }
      );
    }

    // Step 6: Create attempt with the newly created task
    return await createAttempt(
      newTask,
      finalPrompt,
      request_method,
      output_format,
      output_schema,
      timeout
    );

  } catch (error: any) {
    console.error('Failed to create attempt:', error);
    console.error('Error code:', error?.code);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);

    // Handle foreign key constraint (invalid taskId)
    if (error?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      console.error('Foreign key constraint violation');
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create attempt' },
      { status: 500 }
    );
  }
}

// Helper function to create attempt
async function createAttempt(
  task: any,
  prompt: string,
  requestMethod: RequestMethod = 'queue',
  outputFormat?: OutputFormat,
  outputSchema?: string,
  timeout?: number
) {
  const newAttempt = {
    id: nanoid(),
    taskId: task.id,
    prompt,
    status: 'running' as const,
    branch: null,
    diffAdditions: 0,
    diffDeletions: 0,
    createdAt: Date.now(),
    completedAt: null,
    outputFormat: outputFormat || null,
    outputSchema: outputSchema || null,
  };

  await db.insert(schema.attempts).values(newAttempt);

  // Queue mode: return attempt ID immediately (existing behavior)
  if (requestMethod === 'queue') {
    return NextResponse.json(newAttempt, { status: 201 });
  }

  // Sync mode: wait for completion and return formatted output
  if (requestMethod === 'sync') {
    try {
      // Wait for attempt to complete (or timeout)
      const result = await waitForAttemptCompletion(newAttempt.id, { timeout });

      // If timed out, return error with attempt ID for fallback
      if (result.timedOut) {
        return NextResponse.json(
          {
            error: `Attempt timed out after ${timeout || 300000}ms`,
            attemptId: newAttempt.id,
            retryUrl: `/api/attempts/${newAttempt.id}`
          },
          { status: 408 }
        );
      }

      // Attempt completed, fetch logs and format
      const logs = await db.query.attemptLogs.findMany({
        where: eq(schema.attemptLogs.attemptId, newAttempt.id),
        orderBy: [asc(schema.attemptLogs.createdAt)]
      });

      // Parse JSON logs into ClaudeOutput messages
      const messages: ClaudeOutput[] = logs
        .filter(log => log.type === 'json')
        .map(log => {
          try {
            return JSON.parse(log.content) as ClaudeOutput;
          } catch {
            return null;
          }
        })
        .filter(Boolean) as ClaudeOutput[];

      // If no format specified, return JSON (backward compatible)
      const finalFormat = outputFormat || 'json';

      // Format and return
      const formatted = formatOutput(
        messages,
        finalFormat,
        outputSchema || null,
        {
          id: result.attempt.id,
          taskId: result.attempt.taskId,
          prompt: result.attempt.prompt,
          status: result.attempt.status,
          createdAt: result.attempt.createdAt,
          completedAt: result.attempt.completedAt
        }
      );

      return NextResponse.json(formatted, { status: 200 });
    } catch (error) {
      // Handle timeout errors or other issues
      if (error instanceof AttemptTimeoutError) {
        return NextResponse.json(
          {
            error: error.message,
            attemptId: error.attemptId,
            retryUrl: `/api/attempts/${error.attemptId}`
          },
          { status: 408 }
        );
      }

      throw error;
    }
  }

  // Fallback for any other request_method value
  return NextResponse.json(newAttempt, { status: 201 });
}

// Helper function to create new task
async function createNewTask(taskId: string, projectId: string, taskTitle: string) {
  // Get next position for todo status
  const tasksInStatus = await db
    .select()
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.projectId, projectId),
        eq(schema.tasks.status, 'todo')
      )
    )
    .orderBy(desc(schema.tasks.position))
    .limit(1);

  const position = tasksInStatus.length > 0 ? tasksInStatus[0].position + 1 : 0;

  const newTask = {
    id: taskId,
    projectId,
    title: taskTitle,
    description: null,
    status: 'todo' as const,
    position,
    chatInit: false,
    rewindSessionId: null,
    rewindMessageUuid: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    await db.insert(schema.tasks).values(newTask);
    return newTask;
  } catch (error) {
    console.error('Failed to create task:', error);
    return null;
  }
}
