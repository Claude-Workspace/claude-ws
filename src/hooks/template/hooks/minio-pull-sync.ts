import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// Load .env from .claude/hooks/ directory
import { config as dotenvConfig } from "dotenv";
const hooksDir = path.join(process.cwd(), ".claude", "hooks");
dotenvConfig({ path: path.join(hooksDir, ".env") });

/** Simple concurrency limiter — avoids p-limit dependency */
function createConcurrencyLimit(concurrency: number) {
    let active = 0;
    const queue: (() => void)[] = [];
    return function limit<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const run = () => { active++; fn().then(resolve, reject).finally(() => { active--; queue.shift()?.(); }); };
            active < concurrency ? run() : queue.push(run);
        });
    };
}

// ==========================================
// CONFIGURATION
// ==========================================
const config = {
    apiBaseUrl: process.env.API_HOOK_URL as string,
    targetPrefix: "__PROJECT_ID__",
};

if (!config.apiBaseUrl) {
    console.error("❌ Missing API_HOOK_URL in .env!");
    process.exit(1);
}

// Temporary directory configuration
const TMP_DIR = path.join(process.cwd(), ".claude", "tmp");
const MANIFEST_FILE = path.join(TMP_DIR, "minio-sync-manifest.json");
const LOCAL_DATA_DIR = ".";
const LOCAL_STATE_FILE = path.join(TMP_DIR, "local-sync-state.json");

// List of directories to NEVER delete
const PROTECTED_DIRS = [".claude", "temp", "node_modules", ".git"];

// Create temporary directory
async function ensureTmpDir() {
    await fs.mkdir(TMP_DIR, { recursive: true });
}

const USE_MD5_HASH = false;
const MAX_CONCURRENT_DOWNLOADS = 5;

export interface ManifestEntry {
    key: string;
    size: number;
    lastModified: string;
    eTag: string;
    url: string;
}

// ==========================================
// STEP 1: GET MANIFEST FROM API
// ==========================================
async function generateUrls(): Promise<ManifestEntry[]> {
    console.error(`\n=================== STEP 1: FETCH DATA FROM API ===================`);
    console.error(`🔍 Calling API to get manifest for folder '${config.targetPrefix}'...`);

    const url = `${config.apiBaseUrl}/api/sync/manifest?folder=${encodeURIComponent(config.targetPrefix)}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`API manifest failed: HTTP ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    if (json.status !== "success") {
        throw new Error(`API manifest error: ${json.message}`);
    }

    const allObjects: ManifestEntry[] = json.data;
    console.error(`Got ${allObjects.length} files from API.`);

    await fs.writeFile(MANIFEST_FILE, JSON.stringify(allObjects, null, 2));
    console.error(`💾 Manifest saved to file: ${MANIFEST_FILE}`);

    return allObjects;
}

// ==========================================
// STEP 2: SYNC LOCAL
// ==========================================
async function calculateMD5(filePath: string): Promise<string> {
    const hash = crypto.createHash("md5");
    const fileBuffer = await fs.readFile(filePath);
    hash.update(fileBuffer);
    return hash.digest("hex");
}

async function shouldDownload(remote: ManifestEntry, localPath: string): Promise<string | null> {
    try {
        const stats = await fs.stat(localPath);

        if (stats.size !== remote.size) {
            return `Size changed (Local: ${stats.size} != Remote: ${remote.size})`;
        }

        if (USE_MD5_HASH && remote.eTag) {
            const localHash = await calculateMD5(localPath);
            if (localHash !== remote.eTag) return `Content changed (MD5 mismatch)`;
        } else {
            const remoteTime = new Date(remote.lastModified).getTime();
            const localTime = stats.mtime.getTime();
            if (Math.abs(remoteTime - localTime) > 2000 && remoteTime > localTime) {
                return `Remote file is newer (Local from ${stats.mtime.toISOString()})`;
            }
        }

        return null;
    } catch (error: any) {
        if (error.code === "ENOENT") return "New file";
        return `File check error: ${error.message}`;
    }
}

async function downloadFile(url: string, destination: string) {
    // Check if destination conflicts with an existing directory
    try {
        const stats = await fs.stat(destination);
        if (stats.isDirectory()) {
            console.error(`⚠️  Skipping: ${destination} (already exists as directory)`);
            return;
        }
    } catch (e) {
        // File doesn't exist, continue with download
    }

    const dir = path.dirname(destination);
    if (dir !== "." && dir !== process.cwd()) {
        await fs.mkdir(dir, { recursive: true });
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(destination, buffer);
}

async function syncLocal(manifest: ManifestEntry[]) {
    console.error(`\n=================== STEP 2: SYNC LOCAL ===================`);
    console.error(`🚀 Starting to sync ${manifest.length} objects...`);

    let stats = { new: 0, updated: 0, skipped: 0, errors: 0 };
    let completed = 0;
    const limit = createConcurrencyLimit(MAX_CONCURRENT_DOWNLOADS);

    const tasks = manifest.map((remote) =>
        limit(async () => {
            // Strip targetPrefix for cleaner local path
            // E.g.: "698c42f.../markdown/x.md" → "markdown/x.md"
            const strippedKey = remote.key.startsWith(config.targetPrefix + "/")
                ? remote.key.slice(config.targetPrefix.length + 1)
                : remote.key;
            const localPath = path.join(LOCAL_DATA_DIR, strippedKey);
            const reason = await shouldDownload(remote, localPath);

            if (reason) {
                try {
                    await downloadFile(remote.url, localPath);

                    const remoteDate = new Date(remote.lastModified);
                    await fs.utimes(localPath, remoteDate, remoteDate).catch(() => { });

                    console.error(`\n✅ Downloaded: ${remote.key} (${reason})`);
                    if (reason.includes("new")) stats.new++;
                    else stats.updated++;
                } catch (err: any) {
                    console.error(`\n❌ DOWNLOAD FAILED ${remote.key}: ${err.message}`);
                    stats.errors++;
                }
            } else {
                stats.skipped++;
            }

            completed++;
            process.stdout.write(`\r[${completed}/${manifest.length}] Processing... `);
        })
    );

    await Promise.all(tasks);

    console.error(`\n💾 Saving sync state to file: ${LOCAL_STATE_FILE}...`);
    await fs.writeFile(LOCAL_STATE_FILE, JSON.stringify(manifest, null, 2));

    console.error("\n🎉 SYNC COMPLETE!");
    console.error(`  - New files   : ${stats.new}`);
    console.error(`  - Updated    : ${stats.updated}`);
    console.error(`  - Skipped    : ${stats.skipped}`);
    console.error(`  - Errors     : ${stats.errors}`);
}

// ==========================================
// MAIN EXECUTION
// ==========================================
async function runAll() {
    try {
        await ensureTmpDir(); // Create tmp directory before running
        const manifest = await generateUrls();
        await syncLocal(manifest);
    } catch (e) {
        console.error("❌ Main program error:", e);
    }
}

runAll();
