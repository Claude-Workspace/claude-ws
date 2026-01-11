'use client';

import { Folder, FolderOpen, File } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileIconProps {
  name: string;
  type: 'file' | 'directory';
  isExpanded?: boolean;
  className?: string;
}

// Icon config: [label, color]
const EXT_ICONS: Record<string, [string, string]> = {
  js: ['JS', 'text-yellow-500'],
  jsx: ['JS', 'text-yellow-400'],
  mjs: ['JS', 'text-yellow-500'],
  cjs: ['JS', 'text-yellow-500'],
  ts: ['TS', 'text-blue-500'],
  tsx: ['TS', 'text-blue-400'],
  json: ['{ }', 'text-amber-500'],
  yaml: ['Y', 'text-rose-400'],
  yml: ['Y', 'text-rose-400'],
  css: ['#', 'text-purple-500'],
  scss: ['S#', 'text-pink-500'],
  html: ['<>', 'text-orange-500'],
  xml: ['<>', 'text-orange-400'],
  svg: ['◇', 'text-amber-400'],
  md: ['MD', 'text-sky-500'],
  mdx: ['MD', 'text-sky-400'],
  py: ['PY', 'text-green-500'],
  go: ['GO', 'text-cyan-500'],
  rs: ['RS', 'text-orange-600'],
  sh: ['$', 'text-slate-400'],
  sql: ['Q', 'text-cyan-500'],
  png: ['◫', 'text-emerald-500'],
  jpg: ['◫', 'text-emerald-500'],
  jpeg: ['◫', 'text-emerald-500'],
  gif: ['◫', 'text-emerald-500'],
  webp: ['◫', 'text-emerald-500'],
  ico: ['◫', 'text-emerald-500'],
  txt: ['T', 'text-muted-foreground'],
  log: ['≡', 'text-muted-foreground'],
  env: ['⚙', 'text-yellow-600'],
  lock: ['🔒', 'text-slate-500'],
};

// Special files
const FILE_ICONS: Record<string, [string, string]> = {
  'package.json': ['{ }', 'text-green-500'],
  'tsconfig.json': ['TS', 'text-blue-500'],
  'next.config.ts': ['N', 'text-slate-400'],
  'next.config.js': ['N', 'text-slate-400'],
  'next.config.mjs': ['N', 'text-slate-400'],
  'tailwind.config.ts': ['TW', 'text-cyan-400'],
  'tailwind.config.js': ['TW', 'text-cyan-400'],
  '.gitignore': ['G', 'text-orange-500'],
  '.env': ['⚙', 'text-yellow-600'],
  '.env.local': ['⚙', 'text-yellow-600'],
  'README.md': ['i', 'text-sky-500'],
  'Dockerfile': ['🐳', 'text-sky-500'],
};

function getExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function FileIcon({ name, type, isExpanded, className }: FileIconProps) {
  // Folders
  if (type === 'directory') {
    const Icon = isExpanded ? FolderOpen : Folder;
    return <Icon className={cn('size-4 text-amber-500', className)} />;
  }

  // Special files first
  const special = FILE_ICONS[name];
  if (special) {
    return (
      <span className={cn('text-[10px] font-bold w-4 text-center', special[1], className)}>
        {special[0]}
      </span>
    );
  }

  // By extension
  const ext = getExt(name);
  const config = EXT_ICONS[ext];
  if (config) {
    return (
      <span className={cn('text-[10px] font-bold w-4 text-center', config[1], className)}>
        {config[0]}
      </span>
    );
  }

  // Default
  return <File className={cn('size-4 text-muted-foreground', className)} />;
}
