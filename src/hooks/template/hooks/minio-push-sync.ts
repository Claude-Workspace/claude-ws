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
const LOCAL_DATA_DIR = ".";
const STATE_FILE = path.join(TMP_DIR, "local-sync-state.json");
const IGNORED_DIRS = [".claude", "temp", "node_modules", ".git"];

// Hàm tạo thư mục tmp
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
// Gọi API lấy presigned PUT URL rồi upload file
// ==========================================
async function uploadFile(s3Key: string, filePath: string) {
    // Bước 1: Lấy presigned PUT URL từ API
    const urlRes = await fetch(`${config.apiBaseUrl}/api/sync/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: s3Key }),
    });

    if (!urlRes.ok) {
        console.error(`❌ Lấy upload URL thất bại cho ${s3Key}: HTTP ${urlRes.status}`);
        return;
    }

    const { url } = await urlRes.json();
    console.error(`🔗 [Upload Link] - ${s3Key}`);

    // Bước 2: Đọc file và PUT lên MinIO qua presigned URL
    const fileBuffer = await fs.readFile(filePath);
    console.error(`⏳ Đang upload ${filePath} lên MinIO...`);

    const response = await fetch(url, { method: "PUT", body: fileBuffer });

    if (response.ok) {
        console.error(`✅ Upload thành công: ${s3Key}\n`);
    } else {
        console.error(`❌ Lỗi upload ${s3Key} (HTTP ${response.status}): ${response.statusText}\n`);
    }
}

// ==========================================
// Quét toàn bộ file trong thư mục data (Đệ quy)
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
        if (err.code !== "ENOENT") console.error(`Lỗi đọc thư mục ${dir}:`, err);
    }
    return fileList;
}

async function runCheck() {
    await ensureTmpDir(); // Tạo thư mục tmp trước khi chạy
    console.error(`🔍 Bắt đầu quét file trong '${LOCAL_DATA_DIR}' và so sánh với '${STATE_FILE}'...`);

    // Đọc state file (được tạo bởi 0-demo-sync-all.ts)
    let manifestData: ManifestEntry[] = [];
    try {
        manifestData = JSON.parse(await fs.readFile(STATE_FILE, "utf-8"));
    } catch {
        console.error(`❌ Không tìm thấy '${STATE_FILE}'. Chạy script đồng bộ (0-demo-sync-all) trước!`);
        return;
    }

    // Map key → ManifestEntry để tra cứu nhanh
    const manifestMap = new Map<string, ManifestEntry>();
    for (const entry of manifestData) {
        manifestMap.set(entry.key, entry);
    }

    const allFiles = await scanDirectory(LOCAL_DATA_DIR);
    if (allFiles.length === 0) {
        console.error(`❌ Thư mục '${LOCAL_DATA_DIR}' hoàn toàn trống!`);
        return;
    }

    let newFiles = 0;
    let changedFiles = 0;
    let unchangedFiles = 0;

    const MAX_CONCURRENT_CHECKS = 10;
    const limit = createConcurrencyLimit(MAX_CONCURRENT_CHECKS);

    console.error(`Đang phân tích ${allFiles.length} file cục bộ...`);

    const checkTasks = allFiles.map((filePath) =>
        limit(async () => {
            // Lấy relative path từ local data dir, VD: "markdown/ronaldo.md"
            const relativePath = path.relative(LOCAL_DATA_DIR, filePath);

            // Thêm targetPrefix để tạo S3 key đầy đủ
            // VD: "markdown/ronaldo.md" → "698c42f.../markdown/ronaldo.md"
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

    console.error(`\n🎉 HOÀN TẤT KIỂM TRA ĐỒNG BỘ:`);
    console.error(`   - File mới tạo  : ${newFiles}`);
    console.error(`   - File thay đổi : ${changedFiles}`);
    console.error(`   - File giống S3 : ${unchangedFiles}`);
}

runCheck().catch(console.error);
