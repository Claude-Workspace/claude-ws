'use client';

import {
  FileText,
  FileCode,
  FileJson,
  FileImage,
  File,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileIconProps {
  mimeType: string;
  className?: string;
}

// Map MIME types to Lucide icons
export function FileIcon({ mimeType, className }: FileIconProps) {
  const iconClass = cn('size-6', className);

  if (mimeType.startsWith('image/')) {
    return <FileImage className={iconClass} />;
  }

  if (mimeType === 'application/json') {
    return <FileJson className={iconClass} />;
  }

  if (
    mimeType.includes('typescript') ||
    mimeType.includes('javascript') ||
    mimeType === 'text/css' ||
    mimeType === 'text/html' ||
    mimeType === 'text/xml' ||
    mimeType === 'application/xml'
  ) {
    return <FileCode className={iconClass} />;
  }

  if (
    mimeType === 'text/plain' ||
    mimeType === 'text/markdown' ||
    mimeType === 'application/pdf'
  ) {
    return <FileText className={iconClass} />;
  }

  return <File className={iconClass} />;
}
