'use client';

import { Plus, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRightSidebarStore } from '@/stores/right-sidebar-store';

interface RightSidebarProps {
  projectId?: string;
  onCreateTask: () => void;
  onOpenSettings: () => void;
  className?: string;
}

export function RightSidebar({ projectId, onCreateTask, onOpenSettings, className }: RightSidebarProps) {
  const { isOpen, closeRightSidebar } = useRightSidebarStore();

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className="fixed inset-0 bg-black/50 z-40 sm:hidden"
        onClick={closeRightSidebar}
      />

      {/* Sidebar */}
      <div
        className={cn(
          'fixed right-0 top-0 h-full w-64 bg-background border-l shadow-lg z-50',
          'flex flex-col p-4 gap-2',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm">Actions</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeRightSidebar}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Action buttons */}
        <Button
          onClick={() => {
            onCreateTask();
            closeRightSidebar();
          }}
          className="w-full justify-start gap-2"
        >
          <Plus className="h-4 w-4" />
          New Task
        </Button>

        <Button
          variant="outline"
          onClick={() => {
            onOpenSettings();
            closeRightSidebar();
          }}
          className="w-full justify-start gap-2"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </div>
    </>
  );
}
