'use client';

import { useState } from 'react';
import { FolderOpen, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProjectStore } from '@/stores/project-store';
import { FolderBrowserDialog } from './folder-browser-dialog';

interface SetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SetupDialog({ open, onOpenChange }: SetupDialogProps) {
  const { createProject, setCurrentProject } = useProjectStore();
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [folderBrowserOpen, setFolderBrowserOpen] = useState(false);

  const handleFolderSelect = (selectedPath: string) => {
    setPath(selectedPath);
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
            Configure a project folder to use with Claude Code. The folder should contain your codebase.
          </DialogDescription>
        </DialogHeader>

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
            <label htmlFor="path" className="text-sm font-medium">
              Project Path
            </label>
            <div className="flex gap-2">
              <div
                className="relative flex-1 cursor-pointer"
                onClick={() => !loading && setFolderBrowserOpen(true)}
              >
                <FolderOpen className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="path"
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
