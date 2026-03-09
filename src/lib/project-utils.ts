import { join } from 'path';
import { mkdir, writeFile, access, copyFile, readFile, chmod } from 'fs/promises';
import { spawn } from 'child_process';

import { sanitizeDirName } from './file-utils';

/**
 * Generates a unique, non-colliding absolute directory path for a project name.
 * It will append `-1`, `-2`, etc. if the folder already exists.
 *
 * @param baseDir The parent directory where the project should reside
 * @param projectName The requested name of the project
 * @returns A unique absolute path
 */
export async function getUniqueProjectPath(baseDir: string, projectName: string): Promise<string> {
    const sanitized = sanitizeDirName(projectName) || 'untitled-project';

    let currentPath = join(baseDir, sanitized);
    let counter = 1;
    let isUnique = false;

    while (!isUnique) {
        try {
            // access throws if file/dir DOES NOT exist, which means it's available
            await access(currentPath);
            // If we get here, it means the folder exists, so we need to increment
            currentPath = join(baseDir, `${sanitized}-${counter}`);
            counter++;
        } catch {
            // The path does not exist, so it's unique
            isUnique = true;
        }
    }

    return currentPath;
}

/**
 * Setup default Claude workspace structures for a new project
 *
 * @param projectPath The absolute path of the new project
 * @param projectId The unique ID of the project to set as targetPrefix
 */
export async function setupProjectDefaults(projectPath: string, projectId: string, workspaceRoot: string = process.cwd()): Promise<void> {
    try {
        // 1. Create .claude/hooks and commands directories
        const claudeDir = join(projectPath, '.claude');
        const hooksDir = join(claudeDir, 'hooks');
        const commandsDir = join(claudeDir, 'commands');

        await mkdir(hooksDir, { recursive: true });
        await mkdir(commandsDir, { recursive: true });

        const templateHooksDir = join(workspaceRoot, 'src', 'hooks', 'template');

        // 2. Generate standard CLAUDE.md in .claude directory
        const claudeMdPath = join(claudeDir, 'CLAUDE.md');
        try {
            await access(claudeMdPath);
        } catch {
            try {
                await copyFile(
                    join(templateHooksDir, 'CLAUDE.template.md'),
                    claudeMdPath
                );
            } catch (e) {
                console.error('[project-utils] Failed to copy CLAUDE.template.md', e);
            }
        }

        // 3. Create empty .session_permissions file
        const sessionPermsPath = join(claudeDir, '.session_permissions');
        try {
            await writeFile(sessionPermsPath, '', 'utf-8');
        } catch (e) {
            console.error('[project-utils] Failed to create .session_permissions', e);
        }

        // 4. Copy hook and settings templates

        try {
            const pullSyncPath = join(templateHooksDir, 'hooks', 'minio-pull-sync.ts');
            let pullSyncContent = await readFile(pullSyncPath, 'utf-8');
            pullSyncContent = pullSyncContent.replace(/__PROJECT_ID__/g, projectId);
            await writeFile(join(hooksDir, 'minio-pull-sync.ts'), pullSyncContent, 'utf-8');

            const pushSyncPath = join(templateHooksDir, 'hooks', 'minio-push-sync.ts');
            let pushSyncContent = await readFile(pushSyncPath, 'utf-8');
            pushSyncContent = pushSyncContent.replace(/__PROJECT_ID__/g, projectId);
            await writeFile(join(hooksDir, 'minio-push-sync.ts'), pushSyncContent, 'utf-8');

            // Copy block-write.sh hook and make it executable
            const blockWriteHookPath = join(templateHooksDir, 'hooks', 'block-write.sh');
            const blockWriteDestPath = join(hooksDir, 'block-write.sh');
            await copyFile(blockWriteHookPath, blockWriteDestPath);

            // Make the hook executable using spawn for cross-platform compatibility
            await new Promise<void>((resolve, reject) => {
                const chmodProcess = spawn('chmod', ['+x', blockWriteDestPath]);
                chmodProcess.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`chmod failed with code ${code}`));
                    }
                });
                chmodProcess.on('error', reject);
            });

            await copyFile(
                join(templateHooksDir, 'settings.json'),
                join(claudeDir, 'settings.json')
            );

            // Copy command files
            await copyFile(
                join(templateHooksDir, 'commands', 'write.md'),
                join(commandsDir, 'write.md')
            );

            await copyFile(
                join(templateHooksDir, 'commands', 'edit.md'),
                join(commandsDir, 'edit.md')
            );
        } catch (e) {
            console.error('[project-utils] Failed to copy hook templates for new project', e);
        }

        // 5. Generate local .env file for the sync hooks
        const envPath = join(projectPath, '.env');
        try {
            await access(envPath);
        } catch {
            const apiBase = process.env.API_HOOK_URL || process.env.API_BASE_URL || `http://localhost:${process.env.PORT || '8052'}`;
            const envContent = `API_HOOK_URL="${apiBase}"\n`;
            await writeFile(envPath, envContent, 'utf-8');
        }
    } catch (e) {
        console.error('[project-utils] Error setting up project defaults:', e);
    }
}
