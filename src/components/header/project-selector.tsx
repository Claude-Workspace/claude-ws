'use client';

import { FolderOpen, Plus, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
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
  } = useProjectStore();

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
          projects.map((project) => (
            <DropdownMenuCheckboxItem
              key={project.id}
              checked={allMode || selectedProjectIds.includes(project.id)}
              onCheckedChange={() => toggleProjectSelection(project.id)}
            >
              <span className="truncate">{project.name}</span>
            </DropdownMenuCheckboxItem>
          ))
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
