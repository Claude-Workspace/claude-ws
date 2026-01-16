import { NextRequest, NextResponse } from 'next/server';
import { readFile, unlink, mkdir, writeFile, readdir, copyFile } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { existsSync, createReadStream, createWriteStream } from 'fs';
import { verifyApiKey, unauthorizedResponse } from '@/lib/api-auth';
import { getAgentFactoryDir } from '@/lib/agent-factory-dir';
import { uploadSessions, cleanupDirectory, type ExtractedItem, type UploadSession } from '@/lib/upload-sessions';
import { db } from '@/lib/db';
import { agentFactoryPlugins } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import AdmZip from 'adm-zip';
import * as tar from 'tar';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'node:zlib';

// POST /api/agent-factory/upload - Upload and extract component archive
export async function POST(request: NextRequest) {
  try {
    if (!verifyApiKey(request)) {
      return unauthorizedResponse();
    }

    const contentType = request.headers.get('content-type') || '';

    // Handle JSON request (confirm mode with sessionId)
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { sessionId, confirm } = body;

      if (confirm && sessionId) {
        const session = uploadSessions.get(sessionId);
        if (!session) {
          return NextResponse.json({ error: 'Session expired or not found. Please upload again.' }, { status: 400 });
        }

        const agentFactoryDir = getAgentFactoryDir();
        await mkdir(join(agentFactoryDir, 'skills'), { recursive: true });
        await mkdir(join(agentFactoryDir, 'commands'), { recursive: true });
        await mkdir(join(agentFactoryDir, 'agents'), { recursive: true });

        const items = await importFromSession(session, agentFactoryDir);

        // Clean up session
        await cleanupDirectory(session.extractDir);
        uploadSessions.delete(sessionId);

        return NextResponse.json({
          success: true,
          message: `File uploaded successfully. Organized ${items.length} component(s).`,
          items
        });
      }

      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Handle FormData request (file upload)
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const dryRun = formData.get('dryRun') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    const validExtensions = ['.zip', '.tar', '.gz', '.gzip', '.tgz'];
    const isValidExtension = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValidExtension) {
      return NextResponse.json({
        error: 'Invalid file type. Only .zip, .tar, .gz, .gzip, or .tgz files are allowed.'
      }, { status: 400 });
    }

    const agentFactoryDir = getAgentFactoryDir();

    // Ensure target directories exist
    await mkdir(join(agentFactoryDir, 'skills'), { recursive: true });
    await mkdir(join(agentFactoryDir, 'commands'), { recursive: true });
    await mkdir(join(agentFactoryDir, 'agents'), { recursive: true });

    // Save uploaded file to temp directory
    const tempDir = join(process.env.TMPDIR || '/tmp', 'agent-factory-upload');
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    const tempFilePath = join(tempDir, `${Date.now()}-${file.name}`);
    const extractDir = join(tempDir, `extract-${Date.now()}`);
    const buffer = Buffer.from(await file.arrayBuffer());

    // Check file size (max 50MB)
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    if (buffer.length > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 50MB.' }, { status: 400 });
    }

    // Write file to temp
    await writeFile(tempFilePath, buffer);

    // Extract to temporary directory
    await mkdir(extractDir, { recursive: true });

    if (fileName.endsWith('.zip')) {
      await extractZip(tempFilePath, extractDir);
    } else if (fileName.endsWith('.tar') || fileName.endsWith('.tgz')) {
      await extractTar(tempFilePath, extractDir, fileName.endsWith('.tgz'));
    } else if (fileName.endsWith('.gz') || fileName.endsWith('.gzip')) {
      await extractGzip(tempFilePath, extractDir);
    }

    // Clean up temp file (but keep extracted files)
    await unlink(tempFilePath);

    if (dryRun) {
      // Preview mode: analyze and store session
      const previewItems = await analyzeForPreview(extractDir, agentFactoryDir);

      // Create session
      const newSessionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
      uploadSessions.set(newSessionId, {
        extractDir,
        items: previewItems,
        createdAt: Date.now()
      });

      return NextResponse.json({
        success: true,
        sessionId: newSessionId,
        items: previewItems
      });
    }

    // Direct import without preview (for backward compatibility)
    const items = await analyzeAndOrganize(extractDir, agentFactoryDir);
    await cleanupDirectory(extractDir);

    return NextResponse.json({
      success: true,
      message: `File uploaded successfully. Organized ${items.length} component(s).`,
      items
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to upload file'
    }, { status: 500 });
  }
}

function extractDescriptionFromMarkdown(content: string): string | null {
  const yamlMatch = content.match(/^---\n([\s\S]+?)\n---/);
  if (yamlMatch) {
    const yaml = yamlMatch[1];
    const descMatch = yaml.match(/description:\s*(.+)/i);
    if (descMatch) {
      return descMatch[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

async function importFromSession(session: UploadSession, agentFactoryDir: string): Promise<ExtractedItem[]> {
  const importedItems: ExtractedItem[] = [];
  const now = Date.now();

  for (const item of session.items) {
    if (item.type === 'agent_set') {
      // Agent set: copy the entire folder
      await cleanupDirectory(item.targetPath).catch(() => {});
      await mkdir(dirname(item.targetPath), { recursive: true });
      await moveDirectory(item.sourcePath, item.targetPath);

      // Check if component already exists in database
      const existing = await db
        .select()
        .from(agentFactoryPlugins)
        .where(and(
          eq(agentFactoryPlugins.name, item.name),
          eq(agentFactoryPlugins.type, 'agent_set')
        ))
        .get();

      const description = `Agent set containing ${item.componentCount || 0} component(s)`;

      if (existing) {
        // Update existing component
        await db
          .update(agentFactoryPlugins)
          .set({
            description,
            agentSetPath: item.targetPath,
            storageType: 'imported',
            updatedAt: now,
          })
          .where(eq(agentFactoryPlugins.id, existing.id));
      } else {
        // Create new component entry
        const newPlugin = {
          id: nanoid(),
          type: 'agent_set' as const,
          name: item.name,
          description,
          sourcePath: null,
          storageType: 'imported' as const,
          agentSetPath: item.targetPath,
          metadata: null,
          createdAt: now,
          updatedAt: now,
        };
        await db.insert(agentFactoryPlugins).values(newPlugin);
      }
    } else {
      // Regular component (skill, command, agent)
      let mdPath: string;
      if (item.type === 'skill') {
        // Skills are directories - move the entire directory
        const targetDir = dirname(item.targetPath);
        await cleanupDirectory(targetDir).catch(() => {});
        await mkdir(targetDir, { recursive: true });
        await moveDirectory(item.sourcePath, targetDir);
        mdPath = item.targetPath;
      } else {
        // Commands and agents are single files
        await mkdir(dirname(item.targetPath), { recursive: true });
        await unlink(item.targetPath).catch(() => {});
        await copyFile(item.sourcePath, item.targetPath);
        mdPath = item.targetPath;
      }

      // Read the file to extract description
      let description: string | null = null;
      try {
        const content = await readFile(mdPath, 'utf-8');
        description = extractDescriptionFromMarkdown(content);
      } catch {
        // Ignore read errors
      }

      // Check if component already exists in database
      const componentType = item.type === 'unknown' ? 'command' : item.type;
      const existing = await db
        .select()
        .from(agentFactoryPlugins)
        .where(and(
          eq(agentFactoryPlugins.name, item.name),
          eq(agentFactoryPlugins.type, componentType)
        ))
        .get();

      if (existing) {
        // Update existing component
        await db
          .update(agentFactoryPlugins)
          .set({
            description,
            sourcePath: item.targetPath,
            storageType: 'imported',
            updatedAt: now,
          })
          .where(eq(agentFactoryPlugins.id, existing.id));
      } else {
        // Create new component entry
        const newPlugin = {
          id: nanoid(),
          type: componentType,
          name: item.name,
          description,
          sourcePath: item.targetPath,
          storageType: 'imported' as const,
          agentSetPath: null,
          metadata: null,
          createdAt: now,
          updatedAt: now,
        };
        await db.insert(agentFactoryPlugins).values(newPlugin);
      }
    }

    importedItems.push(item);
  }

  return importedItems;
}

async function analyzeForPreview(extractDir: string, agentFactoryDir: string): Promise<ExtractedItem[]> {
  const items: ExtractedItem[] = [];
  const entries = await readdir(extractDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const entryPath = join(extractDir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'skills' || entry.name === 'commands' || entry.name === 'agents') {
        // Direct pre-organized structure at root
        await previewDirectoryContents(entryPath, agentFactoryDir, items, entry.name as 'skill' | 'command' | 'agent');
      } else {
        // Check if this is an agent set (contains agents/commands/skills subdirectories)
        const subEntries = await readdir(entryPath, { withFileTypes: true });
        const hasSubdirs = subEntries.some(e =>
          e.isDirectory() && (e.name === 'skills' || e.name === 'commands' || e.name === 'agents')
        );

        if (hasSubdirs) {
          // This is an agent set - create a single item for the whole set
          const agentSetName = entry.name;
          let componentCount = 0;

          // Count components in the agent set
          for (const subEntry of subEntries) {
            if (subEntry.name.startsWith('.')) continue;
            if (subEntry.isDirectory() && (subEntry.name === 'skills' || subEntry.name === 'commands' || subEntry.name === 'agents')) {
              const subEntryPath = join(entryPath, subEntry.name);
              const subDirEntries = await readdir(subEntryPath, { withFileTypes: true });
              componentCount += subDirEntries.filter(e => !e.name.startsWith('.')).length;
            }
          }

          items.push({
            type: 'agent_set',
            sourcePath: entryPath,
            targetPath: join(agentFactoryDir, 'agent-sets', agentSetName),
            name: agentSetName,
            componentCount
          });
        } else {
          const skillMdPath = join(entryPath, 'SKILL.md');
          if (existsSync(skillMdPath)) {
            items.push({
              type: 'skill',
              sourcePath: entryPath,
              targetPath: join(agentFactoryDir, 'skills', entry.name, 'SKILL.md'),
              name: entry.name
            });
          } else {
            await previewDirectory(entryPath, agentFactoryDir, entry.name, items);
          }
        }
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const content = await readFile(entryPath, 'utf-8');
      const type = detectPluginType(content, entry.name);
      let targetPath: string;
      const targetName = basename(entryPath, '.md');

      if (type === 'skill') {
        targetPath = join(agentFactoryDir, 'skills', targetName, 'SKILL.md');
      } else {
        const subdir = type === 'agent' ? 'agents' : 'commands';
        targetPath = join(agentFactoryDir, subdir, `${targetName}.md`);
      }

      items.push({
        type,
        sourcePath: entryPath,
        targetPath,
        name: targetName
      });
    }
  }

  return items;
}

async function previewDirectory(dirPath: string, agentFactoryDir: string, dirName: string, items: ExtractedItem[]) {
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const entryPath = join(dirPath, entry.name);
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const content = await readFile(entryPath, 'utf-8');
      const type = detectPluginType(content, entry.name);
      const targetName = basename(entryPath, '.md');
      let targetPath: string;

      if (type === 'skill') {
        targetPath = join(agentFactoryDir, 'skills', targetName, 'SKILL.md');
      } else {
        const subdir = type === 'agent' ? 'agents' : 'commands';
        targetPath = join(agentFactoryDir, subdir, `${targetName}.md`);
      }

      items.push({
        type,
        sourcePath: entryPath,
        targetPath,
        name: targetName
      });
    }
  }
}

async function previewDirectoryContents(sourceDir: string, targetDir: string, items: ExtractedItem[], type: 'skill' | 'command' | 'agent') {
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);

    if (entry.isDirectory()) {
      items.push({
        type,
        sourcePath,
        targetPath,
        name: entry.name
      });
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      items.push({
        type,
        sourcePath,
        targetPath,
        name: entry.name
      });
    }
  }
}

async function analyzeAndOrganize(extractDir: string, agentFactoryDir: string): Promise<ExtractedItem[]> {
  const items: ExtractedItem[] = [];
  const entries = await readdir(extractDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const entryPath = join(extractDir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'skills' || entry.name === 'commands' || entry.name === 'agents') {
        const targetDir = join(agentFactoryDir, entry.name);
        await moveDirectoryContents(entryPath, targetDir, items, entry.name as 'skill' | 'command' | 'agent');
      } else {
        // Check if this is an agent set (contains agents/commands/skills subdirectories)
        const subEntries = await readdir(entryPath, { withFileTypes: true });
        const hasSubdirs = subEntries.some(e =>
          e.isDirectory() && (e.name === 'skills' || e.name === 'commands' || e.name === 'agents')
        );

        if (hasSubdirs) {
          // This is an agent set - create a single item for the whole set
          const agentSetName = entry.name;
          const targetPath = join(agentFactoryDir, 'agent-sets', agentSetName);
          await cleanupDirectory(targetPath).catch(() => {});
          await mkdir(dirname(targetPath), { recursive: true });
          await moveDirectory(entryPath, targetPath);
          items.push({
            type: 'agent_set',
            sourcePath: entryPath,
            targetPath,
            name: agentSetName
          });
        } else {
          const skillMdPath = join(entryPath, 'SKILL.md');
          if (existsSync(skillMdPath)) {
            const targetPath = join(agentFactoryDir, 'skills', entry.name);
            await moveDirectory(entryPath, targetPath);
            items.push({
              type: 'skill',
              sourcePath: entryPath,
              targetPath: join(targetPath, 'SKILL.md'),
              name: entry.name
            });
          } else {
            await processDirectory(entryPath, agentFactoryDir, entry.name, items);
          }
        }
      }
    } else if (entry.isFile()) {
      await processFile(entryPath, agentFactoryDir, items);
    }
  }

  return items;
}

async function processDirectory(dirPath: string, agentFactoryDir: string, dirName: string, items: ExtractedItem[]) {
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const entryPath = join(dirPath, entry.name);
    if (entry.isFile() && entry.name.endsWith('.md')) {
      await processFile(entryPath, agentFactoryDir, items, dirName);
    }
  }
}

async function processFile(filePath: string, agentFactoryDir: string, items: ExtractedItem[], parentDir?: string) {
  const fileName = basename(filePath);

  if (!fileName.endsWith('.md')) return;

  const content = await readFile(filePath, 'utf-8');
  const type = detectPluginType(content, fileName);

  let targetPath: string;
  let targetName: string;

  if (type === 'skill') {
    targetName = parentDir || basename(filePath, '.md');
    targetPath = join(agentFactoryDir, 'skills', targetName, 'SKILL.md');
    await mkdir(dirname(targetPath), { recursive: true });
  } else {
    targetName = basename(filePath, '.md');
    const subdir = type === 'agent' ? 'agents' : 'commands';
    targetPath = join(agentFactoryDir, subdir, `${targetName}.md`);
  }

  await copyFile(filePath, targetPath);
  items.push({
    type,
    sourcePath: filePath,
    targetPath,
    name: targetName
  });
}

function detectPluginType(content: string, fileName: string): 'skill' | 'command' | 'agent' | 'unknown' {
  const lowerContent = content.toLowerCase();
  const lowerFileName = fileName.toLowerCase();

  const yamlMatch = content.match(/^---\n([\s\S]+?)\n---/);
  if (yamlMatch) {
    const yaml = yamlMatch[1].toLowerCase();
    if (yaml.includes('type:') && yaml.includes('skill')) return 'skill';
    if (yaml.includes('type:') && yaml.includes('command')) return 'command';
    if (yaml.includes('type:') && yaml.includes('agent')) return 'agent';
  }

  if (lowerContent.includes('@skill')) return 'skill';
  if (lowerContent.includes('@command')) return 'command';
  if (lowerContent.includes('@agent')) return 'agent';

  if (lowerFileName.includes('skill')) return 'skill';
  if (lowerFileName.includes('command')) return 'command';
  if (lowerFileName.includes('agent')) return 'agent';

  if (lowerContent.includes('skill_name') || lowerContent.includes('skill name')) return 'skill';
  if (lowerContent.includes('command_name') || lowerContent.includes('command name')) return 'command';
  if (lowerContent.includes('agent_name') || lowerContent.includes('agent name')) return 'agent';

  return 'command';
}

async function moveDirectoryContents(sourceDir: string, targetDir: string, items: ExtractedItem[], type: 'skill' | 'command' | 'agent') {
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await moveDirectory(sourcePath, targetPath);
      items.push({
        type,
        sourcePath,
        targetPath,
        name: entry.name
      });
    } else if (entry.isFile()) {
      await mkdir(dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
      items.push({
        type,
        sourcePath,
        targetPath,
        name: entry.name
      });
    }
  }
}

async function moveDirectory(source: string, target: string) {
  await mkdir(target, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = join(source, entry.name);
    const targetPath = join(target, entry.name);

    if (entry.isDirectory()) {
      await moveDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await copyFile(sourcePath, targetPath);
    }
  }
}

async function extractZip(filePath: string, targetDir: string) {
  const zip = new AdmZip(filePath);
  zip.extractAllTo(targetDir, true);
}

async function extractTar(filePath: string, targetDir: string, gzipped: boolean) {
  const extractOptions = {
    file: filePath,
    cwd: targetDir,
    gzip: gzipped,
  };
  await tar.x(extractOptions);
}

async function extractGzip(filePath: string, targetDir: string) {
  const baseName = filePath.replace(/\.gz$|\.gzip$/i, '');
  const outputPath = join(targetDir, baseName.split('/').pop() || 'file');

  return new Promise<void>((resolve, reject) => {
    const decompressor = createGunzip();
    const input = createReadStream(filePath);
    const output = createWriteStream(outputPath);

    decompressor.on('error', reject);
    output.on('error', reject);
    output.on('finish', async () => {
      if (baseName.endsWith('.tar')) {
        await extractTar(outputPath, targetDir, false);
        await unlink(outputPath);
      }
      resolve();
    });

    pipeline(input, decompressor, output).catch(reject);
  });
}
