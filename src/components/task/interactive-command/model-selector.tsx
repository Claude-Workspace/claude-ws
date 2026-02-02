'use client';

import { useState, useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useInteractiveCommandStore } from '@/stores/interactive-command-store';
import { cn } from '@/lib/utils';

interface Model {
  id: string;
  name: string;
  description?: string;
  tier?: string;
}

interface ModelSelectorProps {
  currentModel: string;
}

export function ModelSelector({ currentModel }: ModelSelectorProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(currentModel);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { closeCommand, setError } = useInteractiveCommandStore();

  // Fetch models from API
  useEffect(() => {
    async function fetchModels() {
      try {
        const res = await fetch('/api/models');
        if (res.ok) {
          const data = await res.json();
          setModels(data.models || []);
          if (data.current) {
            setSelectedModel(data.current);
          }
        }
      } catch {
        // Ignore fetch errors, use empty list
      } finally {
        setLoading(false);
      }
    }
    fetchModels();
  }, []);

  // Handle model selection
  const handleSelect = async (modelId: string) => {
    if (modelId === currentModel) {
      closeCommand();
      return;
    }

    setSelectedModel(modelId);
    setSaving(true);

    try {
      const res = await fetch('/api/models', {
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
    if (models.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIndex = models.findIndex((m) => m.id === selectedModel);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = Math.min(currentIndex + 1, models.length - 1);
        setSelectedModel(models[nextIndex].id);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = Math.max(currentIndex - 1, 0);
        setSelectedModel(models[prevIndex].id);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelect(selectedModel);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedModel, models]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
        No models available
      </div>
    );
  }

  return (
    <div className="divide-y">
      {models.map((model, index) => (
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
              {index === 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  Default
                </span>
              )}
            </div>
            {model.tier && (
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">{model.tier}</p>
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
