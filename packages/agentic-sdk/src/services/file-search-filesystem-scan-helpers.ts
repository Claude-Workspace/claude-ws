/**
 * Filesystem scan helpers for file-name search and content search.
 * Pure utility functions with no external dependencies beyond Node.js builtins.
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';

export const EXCLUDED_DIRS = ['node_modules', '.git', '.next', 'dist', 'build', '.turbo', '__pycache__', '.cache'];
export const EXCLUDED_FILES = ['.DS_Store', 'Thumbs.db'];
export const BINARY_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.woff', '.woff2', '.ttf', '.eot',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.webm',
  '.sqlite', '.db',
];
export const MAX_SEARCH_FILE_SIZE = 5 * 1024 * 1024;

/** Simple fuzzy match: every character of query must appear in text in order */
export function simpleFuzzyMatch(text: string, query: string): boolean {
  let ti = 0, qi = 0;
  while (ti < text.length && qi < query.length) {
    if (text[ti] === query[qi]) qi++;
    ti++;
  }
  return qi === query.length;
}

/** Recursively collect all non-hidden, non-excluded files under dirPath */
export function collectAllFiles(
  dirPath: string,
  basePath: string,
  results: Array<{ name: string; path: string; type: 'file' | 'directory' }>
) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory() && EXCLUDED_DIRS.includes(entry.name)) continue;
      if (entry.isFile() && EXCLUDED_FILES.includes(entry.name)) continue;
      const fullPath = path.join(dirPath, entry.name);
      results.push({
        name: entry.name,
        path: path.relative(basePath, fullPath),
        type: entry.isDirectory() ? 'directory' : 'file',
      });
      if (entry.isDirectory()) collectAllFiles(fullPath, basePath, results);
    }
  } catch { /* skip unreadable */ }
}

/** Escape special regex characters in a literal string */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type ContentMatch = { lineNumber: number; line: string; column: number; matchLength: number };

/** Search a single file for regex matches, line by line */
export async function searchFileContent(
  filePath: string,
  pattern: RegExp,
  limit: number
): Promise<ContentMatch[]> {
  return new Promise((resolve) => {
    const matches: ContentMatch[] = [];
    try {
      const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
      let lineNumber = 0;
      rl.on('line', (line) => {
        lineNumber++;
        if (matches.length >= limit) { rl.close(); return; }
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(line)) !== null && matches.length < limit) {
          matches.push({
            lineNumber,
            line: line.length > 500 ? line.substring(0, 500) + '...' : line,
            column: match.index,
            matchLength: match[0].length,
          });
          if (match[0].length === 0) break;
        }
      });
      rl.on('close', () => resolve(matches));
      rl.on('error', () => resolve(matches));
      fileStream.on('error', () => resolve(matches));
    } catch { resolve(matches); }
  });
}

export type ContentFileResult = { file: string; matches: ContentMatch[] };

/** Recursively search directory files for regex pattern matches */
export async function searchDirContent(
  dirPath: string,
  basePath: string,
  pattern: RegExp,
  results: ContentFileResult[],
  limitPerFile: number,
  maxFiles: number,
  onMatches: (c: number) => void,
  onFile: () => void
) {
  if (results.length >= maxFiles) return;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= maxFiles) break;
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.includes(entry.name)) continue;
        await searchDirContent(fullPath, basePath, pattern, results, limitPerFile, maxFiles, onMatches, onFile);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (BINARY_EXTENSIONS.includes(ext)) continue;
        try { const s = fs.statSync(fullPath); if (s.size > MAX_SEARCH_FILE_SIZE) continue; } catch { continue; }
        const matches = await searchFileContent(fullPath, pattern, limitPerFile);
        onFile();
        if (matches.length > 0) {
          results.push({ file: path.relative(basePath, fullPath), matches });
          onMatches(matches.length);
        }
      }
    }
  } catch { /* skip */ }
}
