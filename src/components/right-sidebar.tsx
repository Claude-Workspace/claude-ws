'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Plus, Settings, Package, X, Sun, Moon, LogOut, Globe, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRightSidebarStore } from '@/stores/right-sidebar-store';
import { useAgentFactoryUIStore } from '@/stores/agent-factory-ui-store';
import { useSettingsUIStore } from '@/stores/settings-ui-store';
import { useTunnelStore } from '@/stores/tunnel-store';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { clearStoredApiKey } from '@/components/auth/api-key-dialog';
import { dispatchAgentProviderConfig } from '@/components/auth/agent-provider-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const { setWizardOpen, status } = useTunnelStore();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = () => {
    clearStoredApiKey();
    window.location.reload();
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutConfirm(false);
    handleLogout();
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

        {/* Agent Provider - submenu item under Settings */}
        <div className="pl-6">
          <Button
            variant="outline"
            onClick={() => {
              dispatchAgentProviderConfig();
              closeRightSidebar();
            }}
            className="w-full justify-start gap-2"
          >
            <Brain className="h-4 w-4" />
            {t('agentProvider')}
          </Button>
        </div>

        {/* Access Anywhere - submenu item under Settings */}
        <div className="pl-6">
          <Button
            variant="outline"
            onClick={() => {
              // Reset wizard step to 0 so settings dialog logic works correctly
              useTunnelStore.getState().setWizardStep(0);
              setWizardOpen(true);
              closeRightSidebar();
            }}
            className="w-full justify-start gap-2"
          >
            <div className="relative">
              <Globe className="h-4 w-4" />
              {status === 'connected' && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              )}
              {status === 'error' && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-red-500 rounded-full" />
              )}
            </div>
            {t('accessAnywhere')}
          </Button>
        </div>

        {/* Language switcher - submenu item under Settings */}
        <div className="pl-6">
          <LanguageSwitcher />
        </div>

        {/* Logout button - under language switcher */}
        <div className="pl-6">
          <Button
            variant="outline"
            onClick={handleLogoutClick}
            className="w-full justify-start gap-2 text-destructive hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            {t('logout')}
          </Button>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('logoutConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('logoutConfirmMessage')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              value="cancel"
              onClick={() => setShowLogoutConfirm(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              value="logout"
              onClick={handleLogoutConfirm}
            >
              {t('logout')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
