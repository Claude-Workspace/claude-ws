'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileTreeItem } from './file-tree-item';
import { UnifiedSearch, SearchResultsView, type SearchResults } from './unified-search';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useActiveProject } from '@/hooks/use-active-project';
import type { FileEntry } from '@/types';

interface FileTreeProps {
  onFileSelect?: (path: string, lineNumber?: number, column?: number, matchLength?: number) => void;
}

export function FileTree({ onFileSelect }: FileTreeProps) {
  const activeProject = useActiveProject();
  const { expandedFolders, toggleFolder, selectedFile, setSelectedFile, openTab, setEditorPosition } =
    useSidebarStore();

  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);

  // Fetch file tree
  useEffect(() => {
    if (!activeProject?.path) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const fetchTree = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/files?path=${encodeURIComponent(activeProject.path)}&depth=10&t=${Date.now()}`
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
  }, [activeProject?.path, refreshKey]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleFileClick = useCallback(
    (path: string, lineNumber?: number, column?: number, matchLength?: number) => {
      setSelectedFile(path);
      openTab(path); // Open in tab system (will switch to existing tab if already open)
      if (lineNumber !== undefined) {
        setEditorPosition({ lineNumber, column, matchLength });
      } else {
        setEditorPosition(null);
      }
      onFileSelect?.(path, lineNumber, column, matchLength);
    },
    [setSelectedFile, openTab, setEditorPosition, onFileSelect]
  );

  const handleSearchChange = useCallback((results: SearchResults | null) => {
    setSearchResults(results);
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

  if (loading && !searchResults) {
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

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No project selected
      </div>
    );
  }

  const isSearching = searchResults !== null;

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="p-2 border-b flex gap-2">
        <UnifiedSearch onSearchChange={handleSearchChange} className="flex-1" />
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

      {/* Content: Search results OR File tree */}
      <ScrollArea className="flex-1">
        {isSearching ? (
          <SearchResultsView results={searchResults} onFileSelect={handleFileClick} />
        ) : (
          <div className="py-1">{renderTree(entries)}</div>
        )}
      </ScrollArea>
    </div>
  );
}
