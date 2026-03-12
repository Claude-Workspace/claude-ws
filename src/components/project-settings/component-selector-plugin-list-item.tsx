'use client';

import { Check, Loader2, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Plugin as AgentFactoryPlugin } from '@/types/agent-factory';

interface ComponentSelectorPluginListItemProps {
  component: AgentFactoryPlugin;
  isSelected: boolean;
  isInstalled: boolean;
  isUninstalling: boolean;
  onToggle: (id: string) => void;
  onUninstall: (id: string, e: React.MouseEvent) => void;
}

/**
 * Single row in the ComponentSelector plugin list.
 * Renders checkbox, name, type badge, installed badge, and uninstall button.
 */
export function ComponentSelectorPluginListItem({
  component,
  isSelected,
  isInstalled,
  isUninstalling,
  onToggle,
  onUninstall,
}: ComponentSelectorPluginListItemProps) {
  return (
    <div
      className={`relative flex items-start gap-3 p-3 rounded-md transition-colors ${
        isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
      } ${isInstalled ? 'border border-green-200 dark:border-green-900' : ''}`}
    >
      <div
        className="flex items-start gap-3 flex-1"
        onClick={() => onToggle(component.id)}
      >
        <Checkbox
          checked={isSelected}
          onChange={() => onToggle(component.id)}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{component.name}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {component.type}
            </span>
            {isInstalled && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Installed
              </span>
            )}
          </div>
          {component.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {component.description}
            </p>
          )}
          {component.storageType && (
            <p className="text-xs text-muted-foreground mt-1">
              Source: {component.storageType}
            </p>
          )}
        </div>
        {isSelected && !isInstalled && (
          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        )}
      </div>

      {isInstalled && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute bottom-2 right-2 h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={(e) => onUninstall(component.id, e)}
          disabled={isUninstalling}
        >
          {isUninstalling ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Trash2 className="h-3 w-3 mr-1" />
              Uninstall
            </>
          )}
        </Button>
      )}
    </div>
  );
}
