import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Directories to exclude from search
const EXCLUDED_DIRS = ['node_modules', '.git', '.next', 'dist', 'build', '.turbo', '__pycache__', '.cache'];
const EXCLUDED_FILES = ['.DS_Store', 'Thumbs.db'];

interface SearchResult {
  path: string;
  name: string;
  type: 'file' | 'directory';
  relativePath: string;
}

// GET /api/files/search - Search files by name
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const basePath = searchParams.get('basePath');
    const query = searchParams.get('query') || '';
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!basePath) {
      return NextResponse.json({ error: 'basePath parameter is required' }, { status: 400 });
    }

    const resolvedPath = path.resolve(basePath);

    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: 'Path does not exist' }, { status: 404 });
    }

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    // Search files recursively
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();

    searchDirectory(resolvedPath, resolvedPath, queryLower, results, limit);

    // Sort results: exact matches first, then by path length
    results.sort((a, b) => {
      const aExact = a.name.toLowerCase() === queryLower;
      const bExact = b.name.toLowerCase() === queryLower;
      if (aExact !== bExact) return aExact ? -1 : 1;

      const aStarts = a.name.toLowerCase().startsWith(queryLower);
      const bStarts = b.name.toLowerCase().startsWith(queryLower);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;

      return a.relativePath.length - b.relativePath.length;
    });

    return NextResponse.json({ results: results.slice(0, limit) });
  } catch (error) {
    console.error('Error searching files:', error);
    return NextResponse.json({ error: 'Failed to search files' }, { status: 500 });
  }
}

function searchDirectory(
  dirPath: string,
  basePath: string,
  query: string,
  results: SearchResult[],
  limit: number,
  depth: number = 0
): void {
  // Limit depth to prevent infinite recursion
  if (depth > 10 || results.length >= limit * 2) return;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (results.length >= limit * 2) break;

      // Skip hidden files and excluded directories
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory() && EXCLUDED_DIRS.includes(entry.name)) continue;
      if (entry.isFile() && EXCLUDED_FILES.includes(entry.name)) continue;

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);
      const nameLower = entry.name.toLowerCase();

      // Check if name matches query (fuzzy match)
      if (nameLower.includes(query) || fuzzyMatch(nameLower, query)) {
        results.push({
          path: fullPath,
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          relativePath,
        });
      }

      // Recurse into directories
      if (entry.isDirectory()) {
        searchDirectory(fullPath, basePath, query, results, limit, depth + 1);
      }
    }
  } catch (error) {
    // Ignore permission errors
  }
}

// Simple fuzzy matching - checks if all chars of query appear in order
function fuzzyMatch(text: string, query: string): boolean {
  let textIndex = 0;
  let queryIndex = 0;

  while (textIndex < text.length && queryIndex < query.length) {
    if (text[textIndex] === query[queryIndex]) {
      queryIndex++;
    }
    textIndex++;
  }

  return queryIndex === query.length;
}
