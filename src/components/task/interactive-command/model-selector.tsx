'use client';

import { useState, useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useInteractiveCommandStore } from '@/stores/interactive-command-store';
import { cn } from '@/lib/utils';

interface Model {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
}

// Available Claude models
const AVAILABLE_MODELS: Model[] = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Latest Sonnet model', isDefault: true },
  { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', description: 'Most capable model' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Previous Sonnet model' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast and efficient' },
];

interface ModelSelectorProps {
  currentModel: string;
}

export function ModelSelector({ currentModel }: ModelSelectorProps) {
  const [selectedModel, setSelectedModel] = useState<string>(currentModel);
  const [saving, setSaving] = useState(false);
  const { closeCommand, setError } = useInteractiveCommandStore();

  // Handle model selection
  const handleSelect = async (modelId: string) => {
    if (modelId === currentModel) {
      closeCommand();
      return;
    }

    setSelectedModel(modelId);
    setSaving(true);

    try {
      // TODO: Implement model switching API
      const res = await fetch('/api/config/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to switch model');
      }

      closeCommand();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch model');
    } finally {
      setSaving(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIndex = AVAILABLE_MODELS.findIndex((m) => m.id === selectedModel);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = Math.min(currentIndex + 1, AVAILABLE_MODELS.length - 1);
        setSelectedModel(AVAILABLE_MODELS[nextIndex].id);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = Math.max(currentIndex - 1, 0);
        setSelectedModel(AVAILABLE_MODELS[prevIndex].id);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelect(selectedModel);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedModel]);

  return (
    <div className="divide-y">
      {AVAILABLE_MODELS.map((model) => (
        <button
          key={model.id}
          onClick={() => handleSelect(model.id)}
          disabled={saving}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
            'hover:bg-muted/50 disabled:opacity-50',
            selectedModel === model.id && 'bg-primary/10 border-l-2 border-primary'
          )}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{model.name}</span>
              {model.isDefault && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  Default
                </span>
              )}
            </div>
            {model.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{model.description}</p>
            )}
          </div>
          <div className="shrink-0">
            {model.id === currentModel ? (
              <Check className="size-4 text-primary" />
            ) : saving && selectedModel === model.id ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : null}
          </div>
        </button>
      ))}

      {/* Footer */}
      <div className="px-4 py-3 bg-muted/30">
        <p className="text-xs text-muted-foreground">
          <kbd className="px-1 bg-muted rounded">↑↓</kbd> navigate
          <span className="mx-2">·</span>
          <kbd className="px-1 bg-muted rounded">Enter</kbd> select
        </p>
      </div>
    </div>
  );
}
