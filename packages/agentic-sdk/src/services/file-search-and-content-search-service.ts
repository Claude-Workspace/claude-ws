/**
 * File search (by name, fuzzy) and advanced content search service.
 * Handles filesystem-based file/content searching without CLI tools.
 */
import fs from 'fs';
import path from 'path';
import {
  EXCLUDED_DIRS,
  EXCLUDED_FILES,
  simpleFuzzyMatch,
  collectAllFiles,
  escapeRegex,
  searchDirContent,
} from './file-search-filesystem-scan-helpers.ts';

export function createFileSearchService() {
  return {
    /**
     * Search files by name (simple + fuzzy match), sorted by relevance.
     */
    searchFilesByName(
      basePath: string,
      query: string,
      limit: number = 10
    ): Array<{ path: string; name: string; type: 'file' | 'directory'; relativePath: string }> {
      const resolvedPath = path.resolve(basePath);
      if (!fs.existsSync(resolvedPath)) throw new Error('Path does not exist');
      if (!query) return [];

      const results: Array<{ path: string; name: string; type: 'file' | 'directory'; relativePath: string }> = [];
      const queryLower = query.toLowerCase();

      function search(dirPath: string, depth: number = 0) {
        if (depth > 10 || results.length >= limit * 2) return;
        try {
          const entries = fs.readdirSync(dirPath, { withFileTypes: true });
          for (const entry of entries) {
            if (results.length >= limit * 2) break;
            if (entry.name.startsWith('.')) continue;
            if (entry.isDirectory() && EXCLUDED_DIRS.includes(entry.name)) continue;
            if (entry.isFile() && EXCLUDED_FILES.includes(entry.name)) continue;
            const fullPath = path.join(dirPath, entry.name);
            const relativePath = path.relative(resolvedPath, fullPath);
            const nameLower = entry.name.toLowerCase();
            if (nameLower.includes(queryLower) || simpleFuzzyMatch(nameLower, queryLower)) {
              results.push({
                path: fullPath,
                name: entry.name,
                type: entry.isDirectory() ? 'directory' : 'file',
                relativePath,
              });
            }
            if (entry.isDirectory()) search(fullPath, depth + 1);
          }
        } catch { /* ignore permission errors */ }
      }

      search(resolvedPath);

      results.sort((a, b) => {
        const aExact = a.name.toLowerCase() === queryLower;
        const bExact = b.name.toLowerCase() === queryLower;
        if (aExact !== bExact) return aExact ? -1 : 1;
        const aStarts = a.name.toLowerCase().startsWith(queryLower);
        const bStarts = b.name.toLowerCase().startsWith(queryLower);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return a.relativePath.length - b.relativePath.length;
      });

      return results.slice(0, limit);
    },

    /**
     * Fuzzy search all files under basePath using caller-supplied fuzzyMatchFn.
     */
    fuzzySearchFiles(
      basePath: string,
      query: string,
      limit: number = 50,
      fuzzyMatchFn?: (q: string, target: string) => { score: number; matches: number[] } | null
    ): { results: Array<{ name: string; path: string; type: 'file' | 'directory'; score: number; matches: number[] }>; total: number } {
      const resolvedPath = path.resolve(basePath);
      if (!fs.existsSync(resolvedPath)) throw new Error('Path does not exist');

      const allFiles: Array<{ name: string; path: string; type: 'file' | 'directory' }> = [];
      collectAllFiles(resolvedPath, resolvedPath, allFiles);

      if (!query?.trim()) {
        return {
          results: allFiles.slice(0, limit).map(f => ({ ...f, score: 0, matches: [] })),
          total: allFiles.length,
        };
      }

      const results: Array<{ name: string; path: string; type: 'file' | 'directory'; score: number; matches: number[] }> = [];
      for (const file of allFiles) {
        if (!fuzzyMatchFn) continue;
        const nameMatch = fuzzyMatchFn(query, file.name);
        const pathMatch = fuzzyMatchFn(query, file.path);
        const match = (nameMatch && pathMatch)
          ? (nameMatch.score >= pathMatch.score ? nameMatch : pathMatch)
          : (nameMatch || pathMatch);
        if (match) results.push({ ...file, score: match.score, matches: match.matches });
      }

      results.sort((a, b) => b.score - a.score);
      return { results: results.slice(0, limit), total: results.length };
    },

    /**
     * Advanced content search with regex, case sensitivity, and whole-word support.
     */
    async searchContentAdvanced(
      basePath: string,
      query: string,
      opts?: {
        caseSensitive?: boolean;
        regex?: boolean;
        wholeWord?: boolean;
        limitPerFile?: number;
        maxFiles?: number;
      }
    ): Promise<{
      results: Array<{ file: string; matches: Array<{ lineNumber: number; line: string; column: number; matchLength: number }> }>;
      totalMatches: number;
      filesSearched: number;
    }> {
      const resolvedPath = path.resolve(basePath);
      if (!fs.existsSync(resolvedPath)) throw new Error('Path does not exist');

      const caseSensitive = opts?.caseSensitive ?? false;
      const useRegex = opts?.regex ?? false;
      const wholeWord = opts?.wholeWord ?? false;
      const limitPerFile = opts?.limitPerFile ?? 100;
      const maxFiles = opts?.maxFiles ?? 50;

      let patternStr = useRegex ? query : escapeRegex(query);
      if (wholeWord) patternStr = `\\b${patternStr}\\b`;
      const pattern = new RegExp(patternStr, caseSensitive ? 'g' : 'gi');

      const results: Array<{ file: string; matches: Array<{ lineNumber: number; line: string; column: number; matchLength: number }> }> = [];
      let totalMatches = 0;
      let filesSearched = 0;

      await searchDirContent(
        resolvedPath, resolvedPath, pattern, results,
        limitPerFile, maxFiles,
        (m) => { totalMatches += m; },
        () => { filesSearched++; }
      );

      return { results, totalMatches, filesSearched };
    },
  };
}
