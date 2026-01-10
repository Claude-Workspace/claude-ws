'use client';

import { useState } from 'react';
import { FolderOpen, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useProjectStore } from '@/stores/project-store';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { currentProject, projects, updateProject, deleteProject, setCurrentProject } =
    useProjectStore();
  const [editingName, setEditingName] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const handleSaveName = async () => {
    if (!currentProject || !editingName.trim()) return;
    await updateProject(currentProject.id, { name: editingName.trim() });
    setIsEditing(false);
  };

  const handleDeleteProject = async () => {
    if (!currentProject) return;
    if (!confirm(`Delete project "${currentProject.name}"? This will remove all tasks and attempts.`)) {
      return;
    }
    await deleteProject(currentProject.id);
    onOpenChange(false);
  };

  const handleSwitchProject = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      setCurrentProject(project);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your project settings and preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Project */}
          {currentProject && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Current Project</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-8"
                        autoFocus
                      />
                      <Button size="sm" onClick={handleSaveName}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsEditing(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-medium">{currentProject.name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingName(currentProject.name);
                          setIsEditing(true);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  {currentProject.path}
                </p>
              </div>
            </div>
          )}

          <Separator />

          {/* All Projects */}
          {projects.length > 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Switch Project</h3>
              <div className="space-y-2">
                {projects
                  .filter((p) => p.id !== currentProject?.id)
                  .map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleSwitchProject(project.id)}
                      className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted text-left"
                    >
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{project.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {project.path}
                        </p>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Danger Zone */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-destructive">Danger Zone</h3>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteProject}
              disabled={!currentProject}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Project
            </Button>
            <p className="text-xs text-muted-foreground">
              This will permanently delete the project and all associated tasks and attempts.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
