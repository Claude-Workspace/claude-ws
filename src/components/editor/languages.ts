import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { yaml } from '@codemirror/lang-yaml';
import { markdown } from '@codemirror/lang-markdown';
import { php } from '@codemirror/lang-php';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { rust } from '@codemirror/lang-rust';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';

// Language extensions mapping
export const languages: Record<string, () => ReturnType<typeof javascript>> = {
  // JavaScript/TypeScript
  javascript,
  js: javascript,
  jsx: javascript,
  typescript: javascript,
  ts: javascript,
  tsx: javascript,
  mjs: javascript,
  cjs: javascript,

  // HTML
  html,
  htm: html,

  // CSS
  css,
  scss: css,
  sass: css,
  less: css,

  // JSON
  json,

  // Python
  python,
  py: python,

  // YAML
  yaml,
  yml: yaml,

  // Markdown
  markdown,
  md: markdown,
  mdx: markdown,

  // PHP
  php,

  // Java
  java,

  // C/C++
  cpp,
  c: cpp,
  cc: cpp,
  h: cpp,
  hpp: cpp,

  // Rust
  rust,
  rs: rust,

  // SQL
  sql,

  // XML
  xml,
};

// Get language from file extension
export function getLanguageFromFileName(fileName: string): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext) return null;

  // Direct match
  if (ext in languages) return ext;

  return null;
}

// Get language from file path
export function getLanguageFromPath(filePath: string): string | null {
  const fileName = filePath.split('/').pop() || '';
  return getLanguageFromFileName(fileName);
}

// Detect if file is binary based on extension
export function isBinaryFile(fileName: string): boolean {
  const binaryExtensions = [
    'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'svg',
    'mp3', 'mp4', 'wav', 'ogg', 'flac', 'aac',
    'zip', 'tar', 'gz', 'rar', '7z',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'exe', 'dll', 'so', 'dylib', 'app', 'dmg', 'iso',
    'ttf', 'otf', 'woff', 'woff2', 'eot',
    'class', 'jar', 'war', 'ear',
    'o', 'a', 'lib',
    'bin', 'dat', 'db', 'sqlite',
  ];

  const ext = fileName.split('.').pop()?.toLowerCase();
  return ext ? binaryExtensions.includes(ext) : false;
}
