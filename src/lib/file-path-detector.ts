/**
 * Utility for detecting and parsing local file paths in text content.
 * Used to make file references in chat messages clickable to open in editor.
 */

// Common file extensions to match
const FILE_EXTENSIONS = [
  // Code
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'cpp', 'h', 'hpp',
  'cs', 'php', 'lua', 'sh', 'bash', 'zsh', 'fish', 'ps1',
  // Web
  'html', 'htm', 'css', 'scss', 'sass', 'less', 'vue', 'svelte',
  // Data/Config
  'json', 'yaml', 'yml', 'toml', 'xml', 'ini', 'env', 'conf', 'cfg',
  // Docs
  'md', 'mdx', 'txt', 'rst', 'adoc',
  // Other
  'sql', 'graphql', 'gql', 'prisma', 'dockerfile', 'makefile',
].join('|');

// Regex patterns for file path detection
// Matches: /path/to/file.ext, ./relative/path.ext, ../parent/path.ext
// Also matches: src/components/file.tsx (relative paths without ./)
// Supports optional line number suffix: :123 or :123:45 (line:column)
const FILE_PATH_PATTERN = new RegExp(
  // Absolute paths: /path/to/file.ext
  `(?:^|\\s|\\(|\\[|'|"|` + '`' + `)` +
  `(` +
    // Absolute path starting with /
    `(?:/[\\w.-]+)+\\.(?:${FILE_EXTENSIONS})` +
    `|` +
    // Relative paths starting with ./ or ../
    `(?:\\.{1,2}/[\\w.-]+)+\\.(?:${FILE_EXTENSIONS})` +
    `|` +
    // Relative paths like src/path/file.ext (common patterns)
    `(?:(?:src|lib|app|pages|components|utils|hooks|stores|types|styles|public|assets|tests?|specs?|__tests__|config|scripts|packages|apps|modules)/[\\w./-]+\\.(?:${FILE_EXTENSIONS}))` +
  `)` +
  // Optional line number: :123 or :123:45
  `(?::(\\d+)(?::(\\d+))?)?` +
  `(?=$|\\s|\\)|\\]|'|"|` + '`' + `|,|\\.)`,
  'gi'
);

// Simpler pattern for backtick-wrapped paths (common in markdown)
// These are typically already isolated, so we can be more permissive
const BACKTICK_PATH_PATTERN = new RegExp(
  `\`((?:[\\w./-]+\\.(?:${FILE_EXTENSIONS}))(?::(\\d+)(?::(\\d+))?)?)\``,
  'gi'
);

export interface DetectedFilePath {
  /** Full matched text including line numbers */
  fullMatch: string;
  /** Just the file path portion */
  filePath: string;
  /** Line number if specified (1-indexed) */
  lineNumber?: number;
  /** Column number if specified (1-indexed) */
  column?: number;
  /** Start index in original text */
  startIndex: number;
  /** End index in original text */
  endIndex: number;
}

/**
 * Detect file paths in a text string.
 * Returns array of detected file paths with their positions.
 */
export function detectFilePaths(text: string): DetectedFilePath[] {
  const results: DetectedFilePath[] = [];
  const seen = new Set<string>(); // Avoid duplicate matches at same position

  // Check backtick-wrapped paths first (higher priority)
  let match: RegExpExecArray | null;
  while ((match = BACKTICK_PATH_PATTERN.exec(text)) !== null) {
    const fullMatch = match[1]; // Path without backticks
    const key = `${match.index}:${fullMatch}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const lineMatch = fullMatch.match(/:(\d+)(?::(\d+))?$/);
    const filePath = lineMatch ? fullMatch.replace(/:(\d+)(?::(\d+))?$/, '') : fullMatch;

    results.push({
      fullMatch: match[0], // Include backticks for replacement
      filePath,
      lineNumber: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
      column: lineMatch?.[2] ? parseInt(lineMatch[2], 10) : undefined,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  // Check standard file path patterns
  FILE_PATH_PATTERN.lastIndex = 0; // Reset regex state
  while ((match = FILE_PATH_PATTERN.exec(text)) !== null) {
    const pathPart = match[1];
    const lineNumber = match[2] ? parseInt(match[2], 10) : undefined;
    const column = match[3] ? parseInt(match[3], 10) : undefined;

    // Calculate actual start (skip leading whitespace/delimiter)
    const leadingChars = match[0].length - (pathPart.length + (match[2] ? `:${match[2]}`.length : 0) + (match[3] ? `:${match[3]}`.length : 0));
    const actualStart = match.index + leadingChars;
    const key = `${actualStart}:${pathPart}`;

    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      fullMatch: match[0].slice(leadingChars),
      filePath: pathPart,
      lineNumber,
      column,
      startIndex: actualStart,
      endIndex: match.index + match[0].length,
    });
  }

  // Sort by start index
  return results.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Check if a path looks like an absolute or project-relative file path.
 * Used to determine if we should try to open it in the editor.
 */
export function isValidFilePath(path: string): boolean {
  // Must have a file extension
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(path.replace(/:\d+(?::\d+)?$/, ''));
  // Should not contain URL-like patterns
  const isNotUrl = !/^https?:\/\//.test(path) && !/^[a-z]+:\/\//.test(path);
  // Should have at least one path separator or start with dot
  const hasPathStructure = path.includes('/') || path.startsWith('.');

  return hasExtension && isNotUrl && hasPathStructure;
}

/**
 * Resolve a relative file path against a project root.
 * Returns the absolute path.
 */
export function resolveFilePath(filePath: string, projectRoot: string): string {
  // Already absolute
  if (filePath.startsWith('/')) {
    return filePath;
  }

  // Normalize project root (remove trailing slash)
  const root = projectRoot.replace(/\/$/, '');

  // Handle ./ and ../ prefixes
  if (filePath.startsWith('./')) {
    return `${root}/${filePath.slice(2)}`;
  }
  if (filePath.startsWith('../')) {
    // Go up one directory from root
    const parts = root.split('/');
    parts.pop();
    return `${parts.join('/')}/${filePath.slice(3)}`;
  }

  // Assume relative to project root
  return `${root}/${filePath}`;
}
