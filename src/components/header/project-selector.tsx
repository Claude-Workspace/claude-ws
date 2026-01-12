'use client';

import { useState } from 'react';
import { FolderOpen, Plus, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProjectStore } from '@/stores/project-store';

interface ProjectSelectorProps {
  onAddProject?: () => void;
}

// Content component for reuse in mobile dropdown
export function ProjectSelectorContent({ onAddProject }: ProjectSelectorProps) {
  const {
    projects,
    selectedProjectIds,
    toggleProjectSelection,
    selectAllProjects,
    isAllProjectsMode,
    deleteProject,
  } = useProjectStore();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  const handleDeleteClick = (projectId: string) => {
    setProjectToDelete(projectId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (projectToDelete) {
      deleteProject(projectToDelete);
    }
    setDeleteDialogOpen(false);
    setProjectToDelete(null);
  };

  const projectToDeleteName = projects.find(p => p.id === projectToDelete)?.name || '';

  const allMode = isAllProjectsMode();

  return (
    <>
      <DropdownMenuLabel>Projects</DropdownMenuLabel>
      <DropdownMenuSeparator />

      {/* All Projects toggle */}
      <DropdownMenuCheckboxItem
        checked={allMode}
        onCheckedChange={() => selectAllProjects()}
      >
        All Projects
      </DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />

      {/* Project list - max 5 visible, scroll for more */}
      <div className="max-h-[180px] overflow-y-auto">
        {projects.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No projects yet
          </div>
        ) : (
          projects.map((project) => {
            const isSelected = allMode || selectedProjectIds.includes(project.id);
            return (
              <div
                key={project.id}
                className="flex items-center gap-1 px-2 py-1.5 hover:bg-muted cursor-pointer"
                onClick={() => toggleProjectSelection(project.id)}
              >
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleProjectSelection(project.id)}
                    className="shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="truncate text-sm">{project.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(project.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })
        )}
      </div>

      <DropdownMenuSeparator />

      {/* New Project button - opens modal */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 h-8"
        onClick={onAddProject}
      >
        <Plus className="h-4 w-4" />
        New Project
      </Button>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{projectToDeleteName}</strong>? This will remove it from your list but won't delete the project folder.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ProjectSelector({ onAddProject }: ProjectSelectorProps) {
  const {
    projects,
    selectedProjectIds,
    isAllProjectsMode,
  } = useProjectStore();

  // Compute display text
  const allMode = isAllProjectsMode();
  let displayText = 'All Projects';
  if (!allMode) {
    if (selectedProjectIds.length === 1) {
      const project = projects.find(p => p.id === selectedProjectIds[0]);
      displayText = project?.name || 'Select Project';
    } else if (selectedProjectIds.length > 1) {
      displayText = `${selectedProjectIds.length} projects`;
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9">
          <FolderOpen className="h-4 w-4" />
          <span className="max-w-[150px] truncate">{displayText}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <ProjectSelectorContent onAddProject={onAddProject} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
