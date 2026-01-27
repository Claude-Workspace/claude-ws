'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Plus, Settings, Package, X, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRightSidebarStore } from '@/stores/right-sidebar-store';
import { useAgentFactoryUIStore } from '@/stores/agent-factory-ui-store';
import { useSettingsUIStore } from '@/stores/settings-ui-store';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslations } from 'next-intl';

interface RightSidebarProps {
  projectId?: string;
  onCreateTask: () => void;
  className?: string;
}

export function RightSidebar({ projectId, onCreateTask, className }: RightSidebarProps) {
  const t = useTranslations('common');
  const { isOpen, closeRightSidebar } = useRightSidebarStore();
  const { setOpen: setAgentFactoryOpen } = useAgentFactoryUIStore();
  const { setOpen: setSettingsOpen } = useSettingsUIStore();
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
          <h2 className="font-semibold text-sm">{t('actions')}</h2>
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
                  <p>{t('toggleTheme')}</p>
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
          {t('newTask')}
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
          {t('agentFactory')}
        </Button>

        <Button
          variant="outline"
          onClick={() => {
            setSettingsOpen(true);
            closeRightSidebar();
          }}
          className="w-full justify-start gap-2"
        >
          <Settings className="h-4 w-4" />
          {t('settings')}
        </Button>

        {/* Language switcher - submenu item under Settings */}
        <div className="pl-6">
          <LanguageSwitcher />
        </div>
      </div>
    </>
  );
}
