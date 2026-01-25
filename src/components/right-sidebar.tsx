'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Plus, Settings, Package, X, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRightSidebarStore } from '@/stores/right-sidebar-store';
import { useAgentFactoryUIStore } from '@/stores/agent-factory-ui-store';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface RightSidebarProps {
  projectId?: string;
  onCreateTask: () => void;
  onOpenSettings: () => void;
  className?: string;
}

export function RightSidebar({ projectId, onCreateTask, onOpenSettings, className }: RightSidebarProps) {
  const { isOpen, closeRightSidebar } = useRightSidebarStore();
  const { setOpen: setAgentFactoryOpen } = useAgentFactoryUIStore();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

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
          <div className="flex items-center gap-1">
            {/* Theme toggle button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    className="h-8 w-8"
                    disabled={!mounted}
                  >
                    {mounted && resolvedTheme === 'dark' ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Toggle theme</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="ghost"
              size="icon"
              onClick={closeRightSidebar}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
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
            setAgentFactoryOpen(true);
            closeRightSidebar();
          }}
          className="w-full justify-start gap-2"
        >
          <Package className="h-4 w-4" />
          Agent Factory
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
