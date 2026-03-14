import fs from "fs/promises";
import path from "path";

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
const LOCAL_DATA_DIR = ".";
const STATE_FILE = path.join(TMP_DIR, "local-sync-state.json");
const IGNORED_DIRS = [".claude", "temp", "node_modules", ".git"];

// Function to create tmp directory
async function ensureTmpDir() {
    await fs.mkdir(TMP_DIR, { recursive: true });
}

export interface ManifestEntry {
    key: string;
    size: number;
    lastModified: string;
    eTag: string;
    url: string;
}

// ==========================================
// Call API to get presigned PUT URL then upload file
// ==========================================
async function uploadFile(s3Key: string, filePath: string) {
    // Step 1: Get presigned PUT URL from API
    const urlRes = await fetch(`${config.apiBaseUrl}/api/sync/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: s3Key }),
    });

    if (!urlRes.ok) {
        console.error(`❌ Failed to get upload URL for ${s3Key}: HTTP ${urlRes.status}`);
        return;
    }

    const { url } = await urlRes.json();
    console.error(`🔗 [Upload Link] - ${s3Key}`);

    // Step 2: Read file and PUT to MinIO via presigned URL
    const fileBuffer = await fs.readFile(filePath);
    console.error(`⏳ Uploading ${filePath} to MinIO...`);

    const response = await fetch(url, { method: "PUT", body: fileBuffer });

    if (response.ok) {
        console.error(`✅ Upload successful: ${s3Key}\n`);
    } else {
        console.error(`❌ Upload error ${s3Key} (HTTP ${response.status}): ${response.statusText}\n`);
    }
}

// ==========================================
// Scan all files in data directory (Recursive)
// ==========================================
async function scanDirectory(dir: string, fileList: string[] = []) {
    try {
        const files = await fs.readdir(dir, { withFileTypes: true });
        for (const file of files) {
            const filePath = path.join(dir, file.name);

            if (file.isDirectory()) {
                // Skip ignored directories
                if (IGNORED_DIRS.includes(file.name)) {
                    console.error(`⏭️  Skipping ignored directory: ${filePath}`);
                    continue;
                }
                await scanDirectory(filePath, fileList);
            } else {
                fileList.push(filePath);
            }
        }
    } catch (err: any) {
        if (err.code !== "ENOENT") console.error(`Error reading directory ${dir}:`, err);
    }
    return fileList;
}

async function runCheck() {
    await ensureTmpDir(); // Create tmp directory before running
    console.error(`🔍 Starting to scan files in '${LOCAL_DATA_DIR}' and compare with '${STATE_FILE}'...`);

    // Read state file (created by 0-demo-sync-all.ts)
    let manifestData: ManifestEntry[] = [];
    try {
        manifestData = JSON.parse(await fs.readFile(STATE_FILE, "utf-8"));
    } catch {
        console.error(`❌ '${STATE_FILE}' not found. Run sync script (0-demo-sync-all) first!`);
        return;
    }

    // Map key → ManifestEntry for quick lookup
    const manifestMap = new Map<string, ManifestEntry>();
    for (const entry of manifestData) {
        manifestMap.set(entry.key, entry);
    }

    const allFiles = await scanDirectory(LOCAL_DATA_DIR);
    if (allFiles.length === 0) {
        console.error(`❌ Directory '${LOCAL_DATA_DIR}' is completely empty!`);
        return;
    }

    let newFiles = 0;
    let changedFiles = 0;
    let unchangedFiles = 0;

    const MAX_CONCURRENT_CHECKS = 10;
    const limit = createConcurrencyLimit(MAX_CONCURRENT_CHECKS);

    console.error(`Analyzing ${allFiles.length} local files...`);

    const checkTasks = allFiles.map((filePath) =>
        limit(async () => {
            // Get relative path from local data dir, e.g.: "markdown/ronaldo.md"
            const relativePath = path.relative(LOCAL_DATA_DIR, filePath);

            // Add targetPrefix to create full S3 key
            // e.g.: "markdown/ronaldo.md" → "698c42f.../markdown/ronaldo.md"
            const s3Key = config.targetPrefix + "/" + relativePath.split(path.sep).join("/");

            const stats = await fs.stat(filePath);
            const manifestEntry = manifestMap.get(s3Key);

            if (!manifestEntry) {
                console.error(`\n📝 [NEW FILE] ${s3Key}`);
                await uploadFile(s3Key, filePath);
                newFiles++;
            } else if (stats.size !== manifestEntry.size) {
                console.error(`\n🔄 [SIZE CHANGED] ${s3Key} (Local: ${stats.size}, Remote: ${manifestEntry.size})`);
                await uploadFile(s3Key, filePath);
                changedFiles++;
            } else {
                const localMtime = stats.mtime.getTime();
                const s3Mtime = new Date(manifestEntry.lastModified).getTime();

                if (localMtime > s3Mtime + 2000) {
                    console.error(`\n⏳ [TIME CHANGED] ${s3Key}`);
                    await uploadFile(s3Key, filePath);
                    changedFiles++;
                } else {
                    unchangedFiles++;
                }
            }
        })
    );

    await Promise.all(checkTasks);

    console.error(`\n🎉 SYNC CHECK COMPLETE:`);
    console.error(`   - New files   : ${newFiles}`);
    console.error(`   - Changed     : ${changedFiles}`);
    console.error(`   - Unchanged   : ${unchangedFiles}`);
}

runCheck().catch(console.error);
