'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileTreeItem } from './file-tree-item';
import { FileSearch } from './file-search';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useProjectStore } from '@/stores/project-store';
import type { FileEntry } from '@/types';

interface FileTreeProps {
  onFileSelect?: (path: string) => void;
}

export function FileTree({ onFileSelect }: FileTreeProps) {
  const { currentProject } = useProjectStore();
  const { expandedFolders, toggleFolder, selectedFile, setSelectedFile, setPreviewFile } =
    useSidebarStore();

  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch file tree
  useEffect(() => {
    if (!currentProject?.path) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const fetchTree = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/files?path=${encodeURIComponent(currentProject.path)}&depth=10&t=${Date.now()}`
        );
        if (!res.ok) throw new Error('Failed to fetch files');
        const data = await res.json();
        setEntries(data.entries || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchTree();
  }, [currentProject?.path, refreshKey]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Filter entries based on search
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;

    const query = searchQuery.toLowerCase();

    const filterTree = (items: FileEntry[]): FileEntry[] => {
      const result: FileEntry[] = [];

      for (const item of items) {
        const nameMatch = item.name.toLowerCase().includes(query);
        const pathMatch = item.path.toLowerCase().includes(query);

        if (item.type === 'directory' && item.children) {
          const filteredChildren = filterTree(item.children);
          if (filteredChildren.length > 0 || nameMatch || pathMatch) {
            result.push({
              ...item,
              children: filteredChildren.length > 0 ? filteredChildren : item.children,
            });
          }
        } else if (nameMatch || pathMatch) {
          result.push(item);
        }
      }

      return result;
    };

    return filterTree(entries);
  }, [entries, searchQuery]);

  const handleFileClick = useCallback(
    (path: string) => {
      setSelectedFile(path);
      setPreviewFile(path);
      onFileSelect?.(path);
    },
    [setSelectedFile, setPreviewFile, onFileSelect]
  );

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Render tree recursively
  const renderTree = (items: FileEntry[], level: number = 0) => {
    return items.map((entry) => {
      const isExpanded = expandedFolders.has(entry.path);
      const isSelected = selectedFile === entry.path;

      return (
        <div key={entry.path}>
          <FileTreeItem
            entry={entry}
            level={level}
            isExpanded={isExpanded}
            isSelected={isSelected}
            onToggle={() => toggleFolder(entry.path)}
            onClick={() => handleFileClick(entry.path)}
          />
          {entry.type === 'directory' && isExpanded && entry.children && (
            <div>{renderTree(entry.children, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive text-sm">
        {error}
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No project selected
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b flex gap-2">
        <FileSearch onSearch={handleSearch} className="flex-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleRefresh}
          disabled={loading}
          title="Refresh file tree"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="py-1">{renderTree(filteredEntries)}</div>
      </ScrollArea>
    </div>
  );
}
