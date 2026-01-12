'use client';

import { useState, useEffect } from 'react';
import { FolderOpen, AlertCircle, Plus, FolderOpen as FolderOpenIcon, Folder } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useProjectStore } from '@/stores/project-store';
import { FolderBrowserDialog } from './folder-browser-dialog';

type Mode = 'create' | 'open';
type BrowserMode = 'root' | 'project';

interface SetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SetupDialog({ open, onOpenChange }: SetupDialogProps) {
  const { createProject, setCurrentProject } = useProjectStore();
  const [mode, setMode] = useState<Mode>('open');
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [folderBrowserOpen, setFolderBrowserOpen] = useState(false);
  const [browserMode, setBrowserMode] = useState<BrowserMode>('project');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setMode('open');
      setName('');
      setPath('');
      setRootPath('');
      setError('');
    }
  }, [open]);

  // Compute full project path for create mode
  const fullProjectPath = name && rootPath ? `${rootPath}/${name}` : '';

  const handleFolderSelect = (selectedPath: string) => {
    if (browserMode === 'root') {
      setRootPath(selectedPath);
    } else {
      setPath(selectedPath);
      // Auto-derive name from folder path in "open" mode
      if (mode === 'open' && !name) {
        const folderName = selectedPath.split('/').filter(Boolean).pop() || '';
        setName(folderName);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    let finalPath = path;

    // For create mode, build path from root + name
    if (mode === 'create') {
      if (!rootPath.trim()) {
        setError('Root folder is required');
        return;
      }
      finalPath = `${rootPath.trim()}/${name.trim()}`;
    } else {
      // Open mode - path is required
      if (!path.trim()) {
        setError('Project path is required');
        return;
      }
    }

    // Validate path format
    if (!finalPath.startsWith('/') && !finalPath.match(/^[A-Za-z]:\\/)) {
      setError('Please enter an absolute path');
      return;
    }

    setLoading(true);
    try {
      const project = await createProject({ name: name.trim(), path: finalPath.trim() });
      if (project) {
        setCurrentProject(project);
        setName('');
        setPath('');
        setRootPath('');
        onOpenChange(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Set Up Project</DialogTitle>
          <DialogDescription>
            {mode === 'open'
              ? 'Select an existing project folder to open.'
              : 'Configure a project folder to use with Claude Code.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted p-1.5">
            <TabsTrigger
              value="open"
              className="[&[data-state=active]]:![background-color:rgba(255,255,255,0.2)]"
            >
              <FolderOpenIcon className="h-4 w-4" />
              Open Existing
            </TabsTrigger>
            <TabsTrigger
              value="create"
              className="[&[data-state=active]]:![background-color:rgba(255,255,255,0.2)]"
            >
              <Plus className="h-4 w-4" />
              Create New
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="mt-4">
            <form onSubmit={handleSubmit} className="space-y-6 py-4">
              {/* Project Path - auto-named from folder */}
              <div className="space-y-2">
                <label htmlFor="path-open" className="text-sm font-medium">
                  Project Folder
                </label>
                <div className="flex gap-2">
                  <div
                    className="relative flex-1 cursor-pointer"
                    onClick={() => !loading && (setBrowserMode('project'), setFolderBrowserOpen(true))}
                  >
                    <FolderOpen className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="path-open"
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                      placeholder="/path/to/project"
                      className="pl-8 cursor-pointer"
                      disabled={loading}
                      readOnly
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => (setBrowserMode('project'), setFolderBrowserOpen(true))}
                    disabled={loading}
                  >
                    Browse
                  </Button>
                </div>
                {path && (
                  <p className="text-xs text-muted-foreground">
                    Project name: <span className="font-medium">{name || '(auto-detected)'}</span>
                  </p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || !path}>
                  {loading ? 'Opening...' : 'Open Project'}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="create" className="mt-4">
            <form onSubmit={handleSubmit} className="space-y-6 py-4">
              {/* Project Name */}
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Project Name
                </label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-kanban"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  This will be the project folder name
                </p>
              </div>

              {/* Root Folder */}
              <div className="space-y-2">
                <label htmlFor="root-path" className="text-sm font-medium">
                  Root Folder
                </label>
                <div className="flex gap-2">
                  <div
                    className="relative flex-1 cursor-pointer"
                    onClick={() => !loading && (setBrowserMode('root'), setFolderBrowserOpen(true))}
                  >
                    <Folder className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="root-path"
                      value={rootPath}
                      onChange={(e) => setRootPath(e.target.value)}
                      placeholder="/home/user/projects"
                      className="pl-8 cursor-pointer"
                      disabled={loading}
                      readOnly
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => (setBrowserMode('root'), setFolderBrowserOpen(true))}
                    disabled={loading}
                  >
                    Browse
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select the parent folder where project will be created
                </p>
              </div>

              {/* Full Path Preview */}
              {fullProjectPath && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Project will be created at:
                  </label>
                  <div className="p-3 bg-muted rounded-md text-sm font-mono break-all">
                    {fullProjectPath}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || !name || !rootPath}>
                  {loading ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

      <FolderBrowserDialog
        open={folderBrowserOpen}
        onOpenChange={setFolderBrowserOpen}
        onSelect={handleFolderSelect}
      />
    </>
  );
}
