'use client';

import { useState } from 'react';
import { FolderOpen, Plus, ChevronDown, X, Settings } from 'lucide-react';
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
import { ProjectSettingsDialog } from '@/components/project-settings/project-settings-dialog';
import { getFolderName } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface ProjectSelectorProps {
  onAddProject?: () => void;
}

// Content component for reuse in mobile dropdown
export function ProjectSelectorContent({ onAddProject }: ProjectSelectorProps) {
  const tCommon = useTranslations('common');
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsProjectId, setSettingsProjectId] = useState<string | null>(null);

  const openSettings = (projectId: string) => {
    setSettingsProjectId(projectId);
    setSettingsOpen(true);
  };

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
        className="px-2 py-1.5"
      >
        {tCommon('allProjects')}
      </DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />

      {/* Project list - max 5 visible, scroll for more */}
      <div className="max-h-[180px] overflow-y-auto">
        {projects.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            {tCommon('noProjectsYet')}
          </div>
        ) : (
          projects.map((project) => {
            const isSelected = allMode || selectedProjectIds.includes(project.id);
            return (
              <div
                key={project.id}
                className="flex items-center gap-1 px-2 py-1.5 hover:bg-muted cursor-pointer"
                onClick={() => {
                  // Clicking the row (not checkbox) switches to single project mode
                  selectAllProjects(); // First clear selection
                  toggleProjectSelection(project.id); // Then select only this project
                }}
                onMouseDown={(e) => {
                  // Middle-click opens project in new tab
                  if (e.button === 1) {
                    e.preventDefault();
                    const url = new URL(window.location.href);
                    url.searchParams.set('project', project.id);
                    window.open(url.toString(), '_blank');
                  }
                }}
              >
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleProjectSelection(project.id)}
                    className="shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="truncate text-sm select-none">{getFolderName(project.name)}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    openSettings(project.id);
                  }}
                >
                  <Settings className="h-3 w-3" />
                </Button>
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

      {/* Project settings dialog */}
      {settingsProjectId && (
        <ProjectSettingsDialog
          open={settingsOpen}
          onOpenChange={(open) => {
            setSettingsOpen(open);
            if (!open) setSettingsProjectId(null);
          }}
          projectId={settingsProjectId}
        />
      )}
    </>
  );
}

export function ProjectSelector({ onAddProject }: ProjectSelectorProps) {
  const tCommon = useTranslations('common');
  const {
    projects,
    selectedProjectIds,
    isAllProjectsMode,
  } = useProjectStore();

  // Compute display text
  const allMode = isAllProjectsMode();
  let displayText = tCommon('allProjects');
  if (!allMode) {
    if (selectedProjectIds.length === 1) {
      const project = projects.find(p => p.id === selectedProjectIds[0]);
      displayText = project ? getFolderName(project.name) : tCommon('selectProject');
    } else if (selectedProjectIds.length > 1) {
      displayText = `${selectedProjectIds.length} projects`;
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9 w-[180px] justify-start">
          <FolderOpen className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left truncate">{displayText}</span>
          <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <ProjectSelectorContent onAddProject={onAddProject} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
