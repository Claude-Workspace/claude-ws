#!/usr/bin/env node

/**
 * Build sidecar binary for Tauri.
 *
 * The sidecar IS the existing server.ts — the full Next.js + API server.
 * Tauri opens a webview to localhost:8556, so the sidecar must run the
 * complete server (Next.js rendering, API routes, Socket.io, SQLite).
 *
 * Dev mode:  Shell script wrapper → uses $0 dirname to resolve paths
 * Prod mode: Next.js standalone + bundled Node.js binary + wrapper
 *
 * Usage: node scripts/build-sidecar.mjs [--dev]
 */

import { execSync } from 'node:child_process';
import {
  mkdirSync, chmodSync, writeFileSync, existsSync,
  cpSync, rmSync, statSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import http from 'node:http';
import { createWriteStream } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BINARIES_DIR = join(ROOT, 'src-tauri', 'binaries');
const RESOURCES_DIR = join(ROOT, 'src-tauri', 'resources');

// Node.js version to embed (LTS)
const NODE_VERSION = '22.19.0';

// Tauri expects: {name}-{target_triple}[.exe]
const TRIPLE_MAP = {
  'darwin-arm64': 'aarch64-apple-darwin',
  'darwin-x64': 'x86_64-apple-darwin',
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
  'win32-x64': 'x86_64-pc-windows-msvc',
  'win32-arm64': 'aarch64-pc-windows-msvc',
};

// Node.js download arch mapping
const NODE_ARCH_MAP = {
  'darwin-arm64': { os: 'darwin', arch: 'arm64' },
  'darwin-x64': { os: 'darwin', arch: 'x64' },
  'linux-x64': { os: 'linux', arch: 'x64' },
  'linux-arm64': { os: 'linux', arch: 'arm64' },
  'win32-x64': { os: 'win', arch: 'x64' },
  'win32-arm64': { os: 'win', arch: 'arm64' },
};

const isDev = process.argv.includes('--dev');
const skipBuild = process.argv.includes('--skip-build');
const platform = process.platform;
const arch = process.arch;
const key = `${platform}-${arch}`;
const triple = TRIPLE_MAP[key];

if (!triple) {
  console.error(`[build-sidecar] Unsupported platform: ${key}`);
  process.exit(1);
}

const ext = platform === 'win32' ? '.exe' : '';
const targetName = `sidecar-${triple}${ext}`;
const targetPath = join(BINARIES_DIR, targetName);

console.log(`[build-sidecar] Platform: ${key} → ${triple}`);
console.log(`[build-sidecar] Target: ${targetPath}`);
console.log(`[build-sidecar] Mode: ${isDev ? 'DEV (wrapper)' : 'PRODUCTION (standalone)'}`);

mkdirSync(BINARIES_DIR, { recursive: true });

if (isDev) {
  // ─── DEV MODE ───────────────────────────────────────────────
  // Shell script resolves project root relative to its own location.
  // Sidecar binary lives at: src-tauri/binaries/sidecar-{triple}
  // Project root is 2 levels up: ../../
  const wrapperContent = platform === 'win32'
    ? [
        '@echo off',
        'set "SCRIPT_DIR=%~dp0"',
        'cd /d "%SCRIPT_DIR%\\..\\.."',
        'set NODE_ENV=development',
        'npx tsx server.ts %*',
        '',
      ].join('\r\n')
    : [
        '#!/bin/sh',
        'SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"',
        'PROJECT_ROOT="$SCRIPT_DIR/../.."',
        'cd "$PROJECT_ROOT"',
        'export NODE_ENV=development',
        'exec npx tsx server.ts "$@"',
        '',
      ].join('\n');

  writeFileSync(targetPath, wrapperContent);
  if (platform !== 'win32') chmodSync(targetPath, '755');

  console.log(`[build-sidecar] Dev wrapper created: ${targetPath}`);
} else {
  // ─── PRODUCTION MODE ────────────────────────────────────────
  // 1. Build Next.js with standalone output
  // 2. Download Node.js binary
  // 3. Assemble resources directory
  // 4. Create sidecar wrapper that launches node with standalone server

  // Step 1: Build Next.js
  // Use --no-turbopack for production build because Turbopack doesn't generate
  // middleware.js.nft.json which is required for standalone output.
  // Use a separate build output directory to avoid lock conflicts with dev server
  const BUILD_DIST = '.next-prod';
  const buildDistPath = join(ROOT, BUILD_DIST);

  if (skipBuild && existsSync(join(buildDistPath, 'standalone'))) {
    console.log('[build-sidecar] Step 1/4: Skipping Next.js build (--skip-build, standalone exists)');
  } else {
  console.log(`[build-sidecar] Step 1/4: Building Next.js (standalone, webpack) → ${BUILD_DIST}...`);
  if (existsSync(buildDistPath)) {
    rmSync(buildDistPath, { recursive: true, force: true });
  }

  const buildEnv = {
    ...process.env,
    NODE_ENV: 'production',
    NEXT_BUILD_DIST_DIR: BUILD_DIST,
  };
  delete buildEnv.TURBOPACK; // Turbopack doesn't generate middleware.js.nft.json for standalone

  // Build with retry to handle Next.js NFT trace bugs with custom distDir.
  // First attempt may fail on missing middleware/proxy .nft.json files.
  // Second attempt creates stubs and retries.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      execSync('npx next build --webpack', {
        stdio: attempt === 1 ? 'inherit' : ['inherit', 'inherit', 'pipe'],
        cwd: ROOT,
        env: buildEnv,
      });
      break; // Success
    } catch (err) {
      if (attempt >= 2) throw err;
      console.log('[build-sidecar] Build failed, applying NFT workaround and retrying...');
      // Remove stale lock from failed build
      try { rmSync(join(ROOT, BUILD_DIST, 'lock'), { force: true }); } catch { /* ignore */ }
      // Create missing .nft.json stubs and proxy.js for middleware rename
      const nftDir = join(ROOT, BUILD_DIST, 'server');
      mkdirSync(nftDir, { recursive: true });
      const emptyNft = JSON.stringify({ version: 1, files: [] });
      for (const name of ['middleware.js.nft.json', 'proxy.js.nft.json']) {
        if (!existsSync(join(nftDir, name))) {
          writeFileSync(join(nftDir, name), emptyNft);
        }
      }
      // Create proxy.js stub if missing (Next.js renames it to middleware.js)
      if (!existsSync(join(nftDir, 'proxy.js'))) {
        writeFileSync(join(nftDir, 'proxy.js'), '// stub');
      }
    }
  }

  } // end of skipBuild check

  // Verify standalone output exists
  const standaloneDir = join(ROOT, BUILD_DIST, 'standalone');
  if (!existsSync(standaloneDir)) {
    console.error(`[build-sidecar] ERROR: ${BUILD_DIST}/standalone not found!`);
    console.error('Ensure next.config.ts has: output: "standalone"');
    process.exit(1);
  }
  console.log('[build-sidecar] Standalone output verified.');

  // Step 2: Download Node.js binary
  console.log(`[build-sidecar] Step 2/4: Downloading Node.js v${NODE_VERSION}...`);
  const nodeInfo = NODE_ARCH_MAP[key];
  const nodeDir = join(RESOURCES_DIR, 'node');
  mkdirSync(nodeDir, { recursive: true });

  const nodeBinDest = join(nodeDir, platform === 'win32' ? 'node.exe' : 'node');

  if (existsSync(nodeBinDest)) {
    // Check if cached version matches
    try {
      const cachedVersion = execSync(`"${nodeBinDest}" --version`, { encoding: 'utf-8' }).trim();
      if (cachedVersion === `v${NODE_VERSION}`) {
        console.log(`[build-sidecar] Node.js v${NODE_VERSION} already cached.`);
      } else {
        console.log(`[build-sidecar] Cached Node.js is ${cachedVersion}, downloading v${NODE_VERSION}...`);
        await downloadNode(nodeInfo, nodeBinDest);
      }
    } catch {
      await downloadNode(nodeInfo, nodeBinDest);
    }
  } else {
    await downloadNode(nodeInfo, nodeBinDest);
  }

  // Step 3: Assemble standalone server into resources
  // Strategy: Skip pnpm's symlink-based node_modules from standalone output.
  // Instead, copy only the build artifacts (.next) and install a flat npm
  // node_modules with only the runtime deps needed by the server.
  // This avoids pnpm symlink issues in Tauri's read-only .app bundle.
  console.log('[build-sidecar] Step 3/4: Assembling standalone server...');
  const serverDir = join(RESOURCES_DIR, 'server');

  // Clean previous build
  if (existsSync(serverDir)) {
    rmSync(serverDir, { recursive: true, force: true });
  }
  mkdirSync(serverDir, { recursive: true });

  // 3a. Copy build artifacts from standalone (everything EXCEPT node_modules)
  // The standalone output includes: .next-prod/, src/, server.js, package.json
  const standaloneEntries = execSync(`ls -A "${standaloneDir}"`, { encoding: 'utf-8' }).trim().split('\n');
  for (const entry of standaloneEntries) {
    if (entry === 'node_modules' || entry === 'uploads' || entry === 'data' || entry === '.env') continue;
    const src = join(standaloneDir, entry);
    const dest = join(serverDir, entry === BUILD_DIST ? '.next' : entry);
    cpSync(src, dest, { recursive: true });
  }

  // Patch all files: replace BUILD_DIST (.next-prod) → .next
  // The build was done with distDir=.next-prod, but we renamed the directory to .next.
  // Many compiled files (routes, manifests, configs) reference .next-prod paths.
  const nextDir = join(serverDir, '.next');

  // 1. Patch required-server-files.json (critical config)
  const reqServerFiles = join(nextDir, 'required-server-files.json');
  if (existsSync(reqServerFiles)) {
    let reqData = JSON.parse(
      execSync(`cat "${reqServerFiles}"`, { encoding: 'utf-8' })
    );
    if (reqData.config) reqData.config.distDir = '.next';
    reqData.appDir = '.';
    reqData.relativeAppDir = '';
    if (reqData.files) {
      reqData.files = reqData.files.map((f) => f.replace(BUILD_DIST, '.next'));
    }
    writeFileSync(reqServerFiles, JSON.stringify(reqData));
  }

  // 2. Bulk replace .next-prod → .next in all JS/JSON files under .next/server/
  // These files have hardcoded distDir paths from the build.
  try {
    execSync(
      `find "${nextDir}" -type f \\( -name "*.js" -o -name "*.json" \\) -exec sed -i '' 's/${BUILD_DIST}/.next/g' {} +`,
      { stdio: 'inherit' }
    );
    console.log(`[build-sidecar] Patched all .next-prod → .next references`);
  } catch (e) {
    console.warn('[build-sidecar] Warning: sed patch failed, trying alternative...');
    // Fallback for Linux (no '' after -i)
    try {
      execSync(
        `find "${nextDir}" -type f \\( -name "*.js" -o -name "*.json" \\) -exec sed -i 's/${BUILD_DIST}/.next/g' {} +`,
        { stdio: 'inherit' }
      );
    } catch { /* ignore */ }
  }

  // Copy static assets that standalone doesn't include
  const staticSrc = join(ROOT, BUILD_DIST, 'static');
  const staticDest = join(nextDir, 'static');
  if (existsSync(staticSrc)) {
    cpSync(staticSrc, staticDest, { recursive: true });
  }

  // Copy public assets
  const publicSrc = join(ROOT, 'public');
  const publicDest = join(serverDir, 'public');
  if (existsSync(publicSrc)) {
    cpSync(publicSrc, publicDest, { recursive: true });
  }

  // Copy locales for next-intl
  const localesSrc = join(ROOT, 'locales');
  const localesDest = join(serverDir, 'locales');
  if (existsSync(localesSrc)) {
    cpSync(localesSrc, localesDest, { recursive: true });
  }

  // Copy drizzle migrations
  const drizzleSrc = join(ROOT, 'drizzle');
  const drizzleDest = join(serverDir, 'drizzle');
  if (existsSync(drizzleSrc)) {
    cpSync(drizzleSrc, drizzleDest, { recursive: true });
  }

  // 3b. Compile server.ts → custom-server.cjs using esbuild.
  // --packages=external: all node_modules imports resolve at runtime.
  console.log('[build-sidecar] Compiling custom server.ts...');
  execSync(
    'npx esbuild server.ts --bundle --platform=node --target=node22 --outfile=src-tauri/resources/server/custom-server.cjs --format=cjs --packages=external',
    { stdio: 'inherit', cwd: ROOT }
  );

  // 3c. Install ALL runtime deps with npm (flat node_modules, no pnpm symlinks).
  // Create a filtered package.json with only the server-side runtime deps.
  // Exclude frontend-only packages (codemirror, radix-ui, tailwind, etc.)
  // that are already compiled into the .next build output.
  console.log('[build-sidecar] Installing runtime dependencies (flat npm)...');

  // Read project package.json to get dependency versions
  const projPkg = JSON.parse(
    execSync(`cat "${join(ROOT, 'package.json')}"`, { encoding: 'utf-8' })
  );

  // Server-side runtime dependencies needed by custom-server.cjs and Next.js server
  const RUNTIME_DEPS = [
    // Next.js server core
    'next', 'react', 'react-dom',
    // Custom server deps (from server.ts)
    'socket.io', '@anthropic-ai/claude-agent-sdk', '@anthropic-ai/sdk',
    'better-sqlite3', 'drizzle-orm', 'drizzle-kit',
    'ctunnel', 'diff', 'dotenv', 'nanoid',
    // Used by API routes / server components
    'next-intl', 'next-themes',
    'date-fns', 'js-yaml', 'adm-zip', 'busboy', 'tar',
    'zustand', 'sonner', 'clsx', 'class-variance-authority', 'tailwind-merge',
    // Markdown rendering (used in server components)
    'react-markdown', 'rehype-highlight', 'remark-gfm',
    'highlight.js', 'lowlight',
    // Image processing
    'sharp',
  ];

  const runtimePkg = {
    name: 'claude-ws-server',
    version: '1.0.0',
    private: true,
    dependencies: {},
  };
  for (const dep of RUNTIME_DEPS) {
    if (projPkg.dependencies?.[dep]) {
      runtimePkg.dependencies[dep] = projPkg.dependencies[dep];
    }
  }

  writeFileSync(join(serverDir, 'package.json'), JSON.stringify(runtimePkg, null, 2));

  // npm install creates flat, symlink-free node_modules
  execSync('npm install --omit=dev', {
    stdio: 'inherit',
    cwd: serverDir,
    env: { ...process.env, NODE_ENV: 'production' },
  });

  const nm = join(serverDir, 'node_modules');

  // 3d. Copy native module binaries from project's pnpm store.
  // npm install might not build native modules correctly if build tools differ.
  // Copy pre-built .node files from the project's pnpm installation.
  const projectNm = join(ROOT, 'node_modules');
  const nativeModules = [
    {
      src: '.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build/Release/better_sqlite3.node',
      destDir: 'better-sqlite3/build/Release',
      fileName: 'better_sqlite3.node',
    },
  ];
  for (const mod of nativeModules) {
    try {
      const srcPattern = join(projectNm, mod.src);
      const found = execSync(`ls ${srcPattern} 2>/dev/null`, { encoding: 'utf-8' }).trim().split('\n')[0];
      if (found && existsSync(found)) {
        const destPath = join(nm, mod.destDir);
        mkdirSync(destPath, { recursive: true });
        cpSync(found, join(destPath, mod.fileName));
        console.log(`[build-sidecar] Copied native module: ${mod.destDir}`);
      }
    } catch { /* skip if not found */ }
  }

  // 3e. Remove cross-platform sharp binaries (saves ~200MB)
  const sharpPlatforms = {
    'darwin-arm64': 'darwin-arm64',
    'darwin-x64': 'darwin-x64',
    'linux-x64': 'linux-x64',
    'linux-arm64': 'linux-arm64',
    'win32-x64': 'win32-x64',
  };
  const currentSharpPlatform = sharpPlatforms[key] || '';
  const imgDir = join(nm, '@img');
  if (existsSync(imgDir)) {
    try {
      const entries = execSync(`ls "${imgDir}"`, { encoding: 'utf-8' }).trim().split('\n');
      for (const entry of entries) {
        if (entry.startsWith('sharp-') && currentSharpPlatform && !entry.includes(currentSharpPlatform)) {
          rmSync(join(imgDir, entry), { recursive: true, force: true });
        }
      }
    } catch { /* ignore */ }
  }

  // Remove typescript (not needed at runtime, but may be pulled in by drizzle-kit)
  const tsDir = join(nm, 'typescript');
  if (existsSync(tsDir)) rmSync(tsDir, { recursive: true, force: true });

  console.log(`[build-sidecar] Server assembled: ${serverDir}`);

  // Step 4: Create sidecar wrapper
  console.log('[build-sidecar] Step 4/4: Creating sidecar wrapper...');

  // The sidecar wrapper finds Node.js and the server relative to itself.
  // In Tauri macOS bundle: Contents/Resources/
  // In Tauri Linux: /usr/share/{app}/resources/ or next to binary
  // The wrapper uses $0 dirname to resolve paths.
  //
  // Tauri places resources at:
  // - macOS: {app}.app/Contents/Resources/
  // - Linux: /usr/share/{appname}/resources/ (deb) or next to binary (AppImage)
  // - Windows: {install_dir}/resources/
  //
  // The sidecar binary is at:
  // - macOS: {app}.app/Contents/MacOS/sidecar-{triple}
  // - Linux: /usr/bin/sidecar-{triple} (deb) or next to main binary
  // - Windows: {install_dir}/sidecar-{triple}.exe

  const wrapperContent = platform === 'win32'
    ? [
        '@echo off',
        'set "SCRIPT_DIR=%~dp0"',
        '',
        ':: Resources are in the same directory or resources/ subdirectory',
        'if exist "%SCRIPT_DIR%resources\\node\\node.exe" (',
        '  set "NODE_BIN=%SCRIPT_DIR%resources\\node\\node.exe"',
        '  set "SERVER_DIR=%SCRIPT_DIR%resources\\server"',
        ') else (',
        '  set "NODE_BIN=%SCRIPT_DIR%..\\resources\\node\\node.exe"',
        '  set "SERVER_DIR=%SCRIPT_DIR%..\\resources\\server"',
        ')',
        '',
        'set NODE_ENV=production',
        'cd /d "%SERVER_DIR%"',
        '"%NODE_BIN%" custom-server.cjs %*',
        '',
      ].join('\r\n')
    : [
        '#!/bin/sh',
        'SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"',
        '',
        '# Tauri places resources relative to the binary.',
        '# macOS .app bundle: Contents/MacOS/sidecar → Contents/Resources/resources/',
        '#   (Tauri nests bundle.resources inside macOS Resources/ directory)',
        '# Linux: ../resources or ./resources',
        'if [ -d "$SCRIPT_DIR/../Resources/resources/node" ]; then',
        '  # macOS .app bundle (Resources/resources/ — double nesting)',
        '  RESOURCES="$SCRIPT_DIR/../Resources/resources"',
        'elif [ -d "$SCRIPT_DIR/resources/node" ]; then',
        '  # Flat layout (next to binary)',
        '  RESOURCES="$SCRIPT_DIR/resources"',
        'elif [ -d "$SCRIPT_DIR/../resources/node" ]; then',
        '  # Linux installed',
        '  RESOURCES="$SCRIPT_DIR/../resources"',
        'else',
        '  echo "[sidecar] ERROR: Cannot find resources directory" >&2',
        '  echo "[sidecar] SCRIPT_DIR=$SCRIPT_DIR" >&2',
        '  ls -la "$SCRIPT_DIR/../Resources/" 2>/dev/null >&2',
        '  exit 1',
        'fi',
        '',
        'NODE_BIN="$RESOURCES/node/node"',
        'SERVER_DIR="$RESOURCES/server"',
        '',
        'export NODE_ENV=production',
        '',
        '# Ensure user PATH is available (macOS apps from Finder have minimal PATH).',
        '# Claude Agent SDK needs `claude` CLI in PATH.',
        'if [ -z "$__SIDECAR_PATH_SET" ]; then',
        '  export __SIDECAR_PATH_SET=1',
        '  export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin:$HOME/.npm-global/bin:$HOME/.cargo/bin:$PATH"',
        '  if [ -f "$HOME/.zprofile" ]; then',
        '    . "$HOME/.zprofile" 2>/dev/null',
        '  elif [ -f "$HOME/.bash_profile" ]; then',
        '    . "$HOME/.bash_profile" 2>/dev/null',
        '  elif [ -f "$HOME/.profile" ]; then',
        '    . "$HOME/.profile" 2>/dev/null',
        '  fi',
        'fi',
        '',
        'cd "$SERVER_DIR"',
        'exec "$NODE_BIN" custom-server.cjs "$@"',
        '',
      ].join('\n');

  writeFileSync(targetPath, wrapperContent);
  if (platform !== 'win32') chmodSync(targetPath, '755');

  console.log(`[build-sidecar] Sidecar wrapper: ${targetPath}`);

  // Print size summary
  const nodeBinSize = getSize(nodeBinDest);
  const serverSize = getDirSize(serverDir);
  console.log('\n[build-sidecar] Bundle size summary:');
  console.log(`  Node.js binary: ${formatSize(nodeBinSize)}`);
  console.log(`  Server (standalone): ${formatSize(serverSize)}`);
  console.log(`  Total resources: ${formatSize(nodeBinSize + serverSize)}`);
}

console.log('[build-sidecar] Done!');

// ─── Helper Functions ─────────────────────────────────────────

/**
 * Download Node.js binary for the given platform/arch.
 */
async function downloadNode(info, dest) {
  const { os, arch } = info;
  const isWin = os === 'win';
  const ext = isWin ? 'zip' : 'tar.gz';
  const prefix = `node-v${NODE_VERSION}-${os}-${arch}`;
  const url = `https://nodejs.org/dist/v${NODE_VERSION}/${prefix}.${ext}`;

  console.log(`[build-sidecar] Downloading: ${url}`);

  const tmpDir = join(RESOURCES_DIR, '.tmp');
  mkdirSync(tmpDir, { recursive: true });
  const archivePath = join(tmpDir, `${prefix}.${ext}`);

  // Download
  await downloadFile(url, archivePath);

  // Extract just the node binary
  const nodeDir = dirname(dest);
  mkdirSync(nodeDir, { recursive: true });

  if (isWin) {
    // For Windows, use PowerShell to extract zip
    const extractDir = join(tmpDir, 'node-extract');
    mkdirSync(extractDir, { recursive: true });
    execSync(
      `powershell -Command "Expand-Archive -Force '${archivePath}' '${extractDir}'"`,
      { stdio: 'inherit' }
    );
    cpSync(join(extractDir, prefix, 'node.exe'), dest);
  } else {
    // Extract tar.gz — only the bin/node file
    execSync(`tar xzf "${archivePath}" -C "${tmpDir}" "${prefix}/bin/node"`, { stdio: 'inherit' });
    cpSync(join(tmpDir, prefix, 'bin', 'node'), dest);
    chmodSync(dest, '755');
  }

  // Cleanup
  rmSync(tmpDir, { recursive: true, force: true });

  const size = getSize(dest);
  console.log(`[build-sidecar] Node.js binary: ${formatSize(size)}`);
}

/**
 * Download a file via HTTPS with redirect support.
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const handler = (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        // Follow redirect
        const redirectUrl = response.headers.location;
        const client = redirectUrl.startsWith('https') ? https : http;
        client.get(redirectUrl, handler).on('error', reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      const file = createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    };
    https.get(url, handler).on('error', reject);
  });
}

function getSize(filePath) {
  try {
    return statSync(filePath).size;
  } catch {
    return 0;
  }
}

function getDirSize(dirPath) {
  try {
    const result = execSync(`du -sb "${dirPath}" 2>/dev/null || du -sk "${dirPath}" | awk '{print $1*1024}'`, {
      encoding: 'utf-8',
    }).trim();
    return parseInt(result.split('\t')[0], 10) || 0;
  } catch {
    return 0;
  }
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
