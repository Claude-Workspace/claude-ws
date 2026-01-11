'use client';

import { useState, useEffect } from 'react';
import { FolderOpen, AlertCircle, Plus, FolderOpen as FolderOpenIcon } from 'lucide-react';
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

interface SetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SetupDialog({ open, onOpenChange }: SetupDialogProps) {
  const { createProject, setCurrentProject } = useProjectStore();
  const [mode, setMode] = useState<Mode>('open');
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [folderBrowserOpen, setFolderBrowserOpen] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setMode('open');
      setName('');
      setPath('');
      setError('');
    }
  }, [open]);

  const handleFolderSelect = (selectedPath: string) => {
    setPath(selectedPath);
    // Auto-derive name from folder path in "open" mode
    if (mode === 'open' && !name) {
      const folderName = selectedPath.split('/').filter(Boolean).pop() || '';
      setName(folderName);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    if (!path.trim()) {
      setError('Project path is required');
      return;
    }

    // Validate path format
    if (!path.startsWith('/') && !path.match(/^[A-Za-z]:\\/)) {
      setError('Please enter an absolute path');
      return;
    }

    setLoading(true);
    try {
      const project = await createProject({ name: name.trim(), path: path.trim() });
      if (project) {
        setCurrentProject(project);
        setName('');
        setPath('');
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="open">
              <FolderOpenIcon className="h-4 w-4" />
              Open Existing
            </TabsTrigger>
            <TabsTrigger value="create">
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
                    onClick={() => !loading && setFolderBrowserOpen(true)}
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
                    onClick={() => setFolderBrowserOpen(true)}
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
                  placeholder="My Awesome Project"
                  disabled={loading}
                />
              </div>

              {/* Project Path */}
              <div className="space-y-2">
                <label htmlFor="path-create" className="text-sm font-medium">
                  Project Path
                </label>
                <div className="flex gap-2">
                  <div
                    className="relative flex-1 cursor-pointer"
                    onClick={() => !loading && setFolderBrowserOpen(true)}
                  >
                    <FolderOpen className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="path-create"
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                      placeholder="/Users/you/projects/my-project"
                      className="pl-8 cursor-pointer"
                      disabled={loading}
                      readOnly
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFolderBrowserOpen(true)}
                    disabled={loading}
                  >
                    Browse
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Click to browse and select your project folder
                </p>
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
                <Button type="submit" disabled={loading}>
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
        initialPath={path || undefined}
      />
    </>
  );
}
