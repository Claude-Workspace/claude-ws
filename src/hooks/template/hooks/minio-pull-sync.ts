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
// CẤU HÌNH
// ==========================================
const config = {
    apiBaseUrl: process.env.API_HOOK_URL as string,
    targetPrefix: "PROJECT_ID",
};

if (!config.apiBaseUrl || config.targetPrefix.includes("PROJECT_ID")) {
    console.error("❌ Thiếu cấu hình API_HOOK_URL trong .env hoặc PROJECT_ID chưa được khởi tạo!");
    process.exit(1);
}

// Cấu hình thư mục tmp
const TMP_DIR = path.join(process.cwd(), ".claude", "tmp");
const MANIFEST_FILE = path.join(TMP_DIR, "minio-sync-manifest.json");
const LOCAL_DATA_DIR = ".";
const LOCAL_STATE_FILE = path.join(TMP_DIR, "local-sync-state.json");

// Danh sách các thư mục KHÔNG BAO GIỜ được xóa
const PROTECTED_DIRS = [".claude", "temp", "node_modules", ".git"];

// Hàm tạo thư mục tmp
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
// PHẦN 1: LẤY MANIFEST TỪ API
// ==========================================
async function generateUrls(): Promise<ManifestEntry[]> {
    console.error(`\n=================== BƯỚC 1: LẤY DỮ LIỆU TỪ API ===================`);
    console.error(`🔍 Đang gọi API để lấy manifest với folder '${config.targetPrefix}'...`);

    const url = `${config.apiBaseUrl}/api/sync/manifest?folder=${encodeURIComponent(config.targetPrefix)}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`API manifest thất bại: HTTP ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    if (json.status !== "success") {
        throw new Error(`API manifest lỗi: ${json.message}`);
    }

    const allObjects: ManifestEntry[] = json.data;
    console.error(`Đã lấy được ${allObjects.length} files từ API.`);

    await fs.writeFile(MANIFEST_FILE, JSON.stringify(allObjects, null, 2));
    console.error(`💾 Đã ghi Manifest ra file: ${MANIFEST_FILE}`);

    return allObjects;
}

// ==========================================
// PHẦN 2: ĐỒNG BỘ VỀ LOCAL
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
            return `Kích thước thay đổi (Local: ${stats.size} != Remote: ${remote.size})`;
        }

        if (USE_MD5_HASH && remote.eTag) {
            const localHash = await calculateMD5(localPath);
            if (localHash !== remote.eTag) return `Nội dung thay đổi (MD5 không khớp)`;
        } else {
            const remoteTime = new Date(remote.lastModified).getTime();
            const localTime = stats.mtime.getTime();
            if (Math.abs(remoteTime - localTime) > 2000 && remoteTime > localTime) {
                return `Remote file mới hơn (Local có từ ${stats.mtime.toISOString()})`;
            }
        }

        return null;
    } catch (error: any) {
        if (error.code === "ENOENT") return "File mới";
        return `Lỗi check file: ${error.message}`;
    }
}

async function downloadFile(url: string, destination: string) {
    // Kiểm tra nếu destination trùng với một directory đã tồn tại
    try {
        const stats = await fs.stat(destination);
        if (stats.isDirectory()) {
            console.error(`⚠️  Skipping: ${destination} (đã tồn tại là directory)`);
            return;
        }
    } catch (e) {
        // File không tồn tại, tiếp tục download
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
    console.error(`\n=================== BƯỚC 2: ĐỒNG BỘ LOCAL ===================`);
    console.error(`🚀 Bắt đầu đồng bộ ${manifest.length} objects...`);

    let stats = { new: 0, updated: 0, skipped: 0, errors: 0 };
    let completed = 0;
    const limit = createConcurrencyLimit(MAX_CONCURRENT_DOWNLOADS);

    const tasks = manifest.map((remote) =>
        limit(async () => {
            // Strip targetPrefix để lưu local phẳng hơn
            // VD: "698c42f.../markdown/x.md" → "markdown/x.md"
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

                    console.error(`\n✅ Đã tải: ${remote.key} (${reason})`);
                    if (reason.includes("mới")) stats.new++;
                    else stats.updated++;
                } catch (err: any) {
                    console.error(`\n❌ LỖI TẢI ${remote.key}: ${err.message}`);
                    stats.errors++;
                }
            } else {
                stats.skipped++;
            }

            completed++;
            process.stdout.write(`\r[${completed}/${manifest.length}] Đang xử lý... `);
        })
    );

    await Promise.all(tasks);

    console.error(`\n💾 Đang lưu trạng thái đồng bộ ra file: ${LOCAL_STATE_FILE}...`);
    await fs.writeFile(LOCAL_STATE_FILE, JSON.stringify(manifest, null, 2));

    console.error("\n🎉 ĐỒNG BỘ HOÀN TẤT!");
    console.error(`  - Tải mới   : ${stats.new} file`);
    console.error(`  - Cập nhật  : ${stats.updated} file`);
    console.error(`  - Bỏ qua    : ${stats.skipped} file`);
    console.error(`  - Lỗi       : ${stats.errors} file`);
}

// ==========================================
// CHẠY CHƯƠNG TRÌNH
// ==========================================
async function runAll() {
    try {
        await ensureTmpDir(); // Tạo thư mục tmp trước khi chạy
        const manifest = await generateUrls();
        await syncLocal(manifest);
    } catch (e) {
        console.error("❌ Lỗi chương trình chính:", e);
    }
}

runAll();
