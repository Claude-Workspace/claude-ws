'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Folder, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActiveProject } from '@/hooks/use-active-project';
import { FileIcon } from '@/components/sidebar/file-browser/file-icon';

interface FileResult {
  path: string;
  name: string;
  type: 'file' | 'directory';
  relativePath: string;
}

interface FileMentionDropdownProps {
  query: string;
  onSelect: (filePath: string) => void;
  onClose: () => void;
  visible: boolean;
}

export function FileMentionDropdown({
  query,
  onSelect,
  onClose,
  visible,
}: FileMentionDropdownProps) {
  const [results, setResults] = useState<FileResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeProject = useActiveProject();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search files when query changes
  useEffect(() => {
    if (!visible || !activeProject?.path || query.length === 0) {
      setResults([]);
      return;
    }

    const searchFiles = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/files/search?basePath=${encodeURIComponent(activeProject.path)}&query=${encodeURIComponent(query)}&limit=10`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setSelectedIndex(0);
        }
      } catch (error) {
        console.error('File search failed:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchFiles, 150);
    return () => clearTimeout(debounce);
  }, [query, visible, activeProject?.path]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible || results.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % results.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + results.length) % results.length);
          break;
        case 'Tab':
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            onSelect(results[selectedIndex].relativePath);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [visible, results, selectedIndex, onSelect, onClose]
  );

  useEffect(() => {
    if (visible) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [visible, handleKeyDown]);

  // Click outside to close
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={dropdownRef}
      className={cn(
        'absolute z-50 w-64 max-h-40 overflow-y-auto',
        'bg-popover border border-border rounded-md shadow-md',
        'animate-in fade-in-0 slide-in-from-bottom-1 duration-100',
        'bottom-full mb-1 left-0'
      )}
    >
      {loading ? (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
        </div>
      ) : results.length === 0 ? (
        <div className="px-2 py-2 text-xs text-muted-foreground text-center">
          {query ? 'No files found' : 'Type to search...'}
        </div>
      ) : (
        <div className="py-0.5">
          {results.slice(0, 6).map((file, index) => (
            <button
              key={file.path}
              className={cn(
                'w-full flex items-center gap-1.5 px-2 py-1 text-xs text-left',
                'hover:bg-accent transition-colors',
                index === selectedIndex && 'bg-accent'
              )}
              onClick={() => onSelect(file.relativePath)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {file.type === 'directory' ? (
                <Folder className="size-3 text-amber-500 shrink-0" />
              ) : (
                <FileIcon name={file.name} type="file" className="size-3 shrink-0" />
              )}
              <span className="truncate">{file.name}</span>
              {file.relativePath !== file.name && (
                <span className="truncate text-[10px] text-muted-foreground ml-auto">
                  {file.relativePath.split('/').slice(0, -1).join('/').slice(-20) || '.'}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Compact hint */}
      <div className="px-2 py-1 border-t text-[10px] text-muted-foreground">
        <kbd className="px-1 bg-muted rounded">Tab</kbd> to select
      </div>
    </div>
  );
}
