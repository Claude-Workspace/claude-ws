'use client';

import { useEffect } from 'react';
import { ChevronDown, Check, Cpu, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useModelStore } from '@/stores/model-store';
import { cn } from '@/lib/utils';

interface ChatModelSelectorProps {
  disabled?: boolean;
  taskId?: string;
  taskLastModel?: string | null;
}

export function ChatModelSelector({ disabled = false, taskId, taskLastModel }: ChatModelSelectorProps) {
  const { availableModels, isLoading, loadModels, setModel, getTaskModel, getShortName } =
    useModelStore();

  // Load models on mount
  useEffect(() => {
    if (availableModels.length === 0) {
      loadModels();
    }
  }, [availableModels.length, loadModels]);

  // Get current model for this specific task
  const currentModel = taskId ? getTaskModel(taskId, taskLastModel) : useModelStore.getState().defaultModel;
  const shortName = getShortName(taskId, taskLastModel);

  const handleSelectModel = (modelId: string) => {
    setModel(modelId, taskId);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || isLoading}
          className="h-8 px-2 text-muted-foreground hover:text-foreground gap-1"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Cpu className="size-4" />
              <span className="text-xs">{shortName}</span>
              <ChevronDown className="size-3" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        className="w-64 z-[9999]"
        sideOffset={8}
      >
        {availableModels.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => handleSelectModel(model.id)}
            disabled={isLoading}
            className={cn(
              'flex items-center gap-2 cursor-pointer',
              currentModel === model.id && 'bg-primary/10'
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{model.name}</span>
              </div>
              {model.description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {model.description}
                </p>
              )}
            </div>
            {model.id === currentModel && (
              <Check className="size-4 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
