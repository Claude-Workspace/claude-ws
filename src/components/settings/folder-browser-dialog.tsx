'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Folder,
  FolderOpen,
  ChevronUp,
  Home,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface FolderBrowserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

export function FolderBrowserDialog({
  open,
  onOpenChange,
  onSelect,
  initialPath,
}: FolderBrowserDialogProps) {
  const [currentPath, setCurrentPath] = useState(initialPath || '');
  const [directories, setDirectories] = useState<DirectoryEntry[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [homePath, setHomePath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualPath, setManualPath] = useState('');

  const fetchDirectory = async (path?: string) => {
    setLoading(true);
    setError('');
    try {
      const url = path
        ? `/api/filesystem?path=${encodeURIComponent(path)}`
        : '/api/filesystem';
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load directory');
      }

      setCurrentPath(data.currentPath);
      setDirectories(data.directories);
      setParentPath(data.parentPath);
      setHomePath(data.homePath);
      setManualPath(data.currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchDirectory(initialPath || undefined);
    }
  }, [open, initialPath]);

  const handleNavigate = (path: string) => {
    fetchDirectory(path);
  };

  const handleGoUp = () => {
    if (parentPath) {
      fetchDirectory(parentPath);
    }
  };

  const handleGoHome = () => {
    fetchDirectory(homePath);
  };

  const handleManualPathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualPath.trim()) {
      fetchDirectory(manualPath.trim());
    }
  };

  const handleSelect = () => {
    onSelect(currentPath);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[600px] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Select Folder</DialogTitle>
          <DialogDescription>
            Navigate to and select your project folder
          </DialogDescription>
        </DialogHeader>

        {/* Manual path input */}
        <form onSubmit={handleManualPathSubmit} className="flex gap-2">
          <Input
            value={manualPath}
            onChange={(e) => setManualPath(e.target.value)}
            placeholder="/path/to/folder"
            className="flex-1"
          />
          <Button type="submit" variant="outline" size="icon" disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </form>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoUp}
            disabled={!parentPath || loading}
          >
            <ChevronUp className="h-4 w-4 mr-1" />
            Up
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoHome}
            disabled={loading}
          >
            <Home className="h-4 w-4 mr-1" />
            Home
          </Button>
          <span className="text-sm text-muted-foreground truncate flex-1">
            {currentPath}
          </span>
        </div>

        {/* Error message */}
        {error && (
          <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
            {error}
          </div>
        )}

        {/* Directory listing */}
        <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
          <ScrollArea className="h-full">
            {loading ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : directories.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                No subdirectories
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {directories.map((dir) => (
                  <button
                    key={dir.path}
                    onClick={() => handleNavigate(dir.path)}
                    className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted text-left transition-colors"
                  >
                    <Folder className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="truncate">{dir.name}</span>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FolderOpen className="h-4 w-4" />
            <span className="truncate max-w-[300px]">{currentPath}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSelect} disabled={!currentPath}>
              Select This Folder
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
