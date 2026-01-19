#!/usr/bin/env node

/**
 * Claude Workspace CLI Entry Point
 *
 * This script:
 * 1. Auto-migrates the database on first run (using initDb from src/lib/db)
 * 2. Starts the Next.js server with Socket.io
 * 3. Opens browser to localhost:3000
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Get package root directory
const packageRoot = path.resolve(__dirname, '..');

// Handle CLI flags
if (process.argv.includes('--version') || process.argv.includes('-v')) {
  const pkg = require(path.join(packageRoot, 'package.json'));
  console.log(`v${pkg.version}`);
  process.exit(0);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Claude Workspace - Visual workspace for Claude Code

Usage:
  claude-ws [options]

Options:
  -v, --version    Show version number
  -h, --help       Show this help message

Examples:
  claude-ws        Start Claude Workspace server

For more info: https://github.com/Claude-Workspace/claude-ws
  `);
  process.exit(0);
}

// Database path (in user's home directory for persistence)
const DB_DIR = path.join(os.homedir(), '.claude-ws');
const DB_PATH = path.join(DB_DIR, 'claude-ws.db');

// Ensure .claude-ws directory exists
if (!fs.existsSync(DB_DIR)) {
  console.log('[Claude Workspace] Creating database directory:', DB_DIR);
  fs.mkdirSync(DB_DIR, { recursive: true });
}

async function startServer() {
  console.log('[Claude Workspace] Starting server...');
  console.log('[Claude Workspace] Database location:', DB_PATH);
  console.log('[Claude Workspace] Server will be available at http://localhost:8556');
  console.log('');

  const serverPath = path.join(packageRoot, 'server.ts');
  const nextBuildDir = path.join(packageRoot, '.next');
  const nodeModulesDir = path.join(packageRoot, 'node_modules');

  // Check if dependencies are installed
  if (!fs.existsSync(nodeModulesDir) || !fs.existsSync(path.join(nodeModulesDir, 'next'))) {
    console.log('[Claude Workspace] Installing dependencies...');
    const { execSync } = require('child_process');

    let installCmd = 'npm install --production=false';
    try {
      execSync('which pnpm', { stdio: 'ignore' });
      installCmd = 'pnpm install --no-frozen-lockfile';
    } catch {
      // pnpm not found, use npm
    }

    try {
      execSync(installCmd, {
        cwd: packageRoot,
        stdio: 'inherit',
        env: { ...process.env }
      });
    } catch (error) {
      console.error('[Claude Workspace] Failed to install dependencies:', error.message);
      process.exit(1);
    }
  }

  // Check if .next directory has valid build (check BUILD_ID file)
  const buildIdPath = path.join(nextBuildDir, 'BUILD_ID');
  const versionPath = path.join(nextBuildDir, 'package.version');
  const pkg = require(path.join(packageRoot, 'package.json'));

  let needsRebuild = false;

  if (!fs.existsSync(buildIdPath)) {
    needsRebuild = true;
  } else if (fs.existsSync(versionPath)) {
    // Check if package version changed (indicates update)
    const cachedVersion = fs.readFileSync(versionPath, 'utf-8').trim();
    if (cachedVersion !== pkg.version) {
      console.log('[Claude Workspace] Package updated from', cachedVersion, 'to', pkg.version);
      needsRebuild = true;
    }
  } else {
    // No version file, mark for rebuild to be safe
    needsRebuild = true;
  }

  if (needsRebuild) {
    console.log('[Claude Workspace] Building production bundle...');
    console.log('[Claude Workspace] This may take a minute...');
    console.log('');

    const { execSync } = require('child_process');
    try {
      const nextBin = path.join(packageRoot, 'node_modules', '.bin', 'next');

      // Run next build using local binary directly
      execSync(`"${nextBin}" build`, {
        cwd: packageRoot,
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
          NODE_ENV: 'production',
        }
      });

      console.log('');
      console.log('[Claude Workspace] ✓ Build completed successfully!');
      console.log('');

      // Save current version for future checks
      fs.writeFileSync(versionPath, pkg.version);
    } catch (error) {
      console.error('[Claude Workspace] Build failed:', error.message);
      console.error('[Claude Workspace] Please ensure all dependencies are installed');
      process.exit(1);
    }
  } else {
    console.log('[Claude Workspace] Using cached build from:', nextBuildDir);
  }

  // Try to find tsx binary in different possible locations
  let tsxCmd;
  const possiblePaths = [
    path.join(packageRoot, 'node_modules', '.bin', 'tsx'),
    path.join(packageRoot, '..', '.bin', 'tsx'), // For global npm installs
  ];

  // Check if tsx exists in any of the possible paths
  for (const tsxPath of possiblePaths) {
    if (fs.existsSync(tsxPath)) {
      tsxCmd = tsxPath;
      break;
    }
  }

  // If still not found, try using node with --loader tsx
  if (!tsxCmd) {
    try {
      // Try using tsx from global or local pnpm/npm
      const { execSync } = require('child_process');
      execSync('which tsx', { stdio: 'ignore' });
      tsxCmd = 'tsx';
    } catch {
      console.error('[Claude Workspace] Error: tsx not found');
      console.error('[Claude Workspace] Please run: npm install -g tsx');
      console.error('[Claude Workspace] Or: pnpm add -g tsx');
      process.exit(1);
    }
  }

  const server = spawn(tsxCmd, [serverPath], {
    cwd: packageRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'production',
    }
  });

  setupServerHandlers(server);
}

function setupServerHandlers(server) {
  server.on('error', (error) => {
    console.error('[Claude Workspace] Failed to start server:', error.message);
    process.exit(1);
  });

  server.on('close', (code) => {
    console.log(`\n[Claude Workspace] Server exited with code ${code}`);
    process.exit(code);
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n[Claude Workspace] Shutting down gracefully...');
    server.kill('SIGINT');
    setTimeout(() => {
      server.kill('SIGKILL');
      process.exit(0);
    }, 5000);
  });

  process.on('SIGTERM', () => {
    console.log('\n[Claude Workspace] Received SIGTERM, shutting down...');
    server.kill('SIGTERM');
  });
}

async function main() {
  try {
    console.log('');
    console.log('🚀 Claude Workspace - AI Task Management Interface');
    console.log('='.repeat(60));
    console.log('');

    // Database will be auto-initialized by src/lib/db/index.ts on first import
    // No need to run separate migration - initDb() handles it all

    await startServer();

  } catch (error) {
    console.error('[Claude Workspace] Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
