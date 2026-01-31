/**
 * Model Selector - Dropdown for selecting provider and model
 *
 * Displays in the chat input bar, allows selecting provider > model.
 * Uses Portal to render popup outside parent container hierarchy.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Sparkles, Zap, Brain, Check, Lock } from 'lucide-react';
import { useProvidersStore } from '@/stores/providers-store';
import { useZIndexStore } from '@/stores/z-index-store';
import { cn } from '@/lib/utils';

interface ModelSelectorProps {
  selectedProviderId?: string;
  selectedModelId?: string;
  onSelect: (providerId: string, modelId: string) => void;
  disabled?: boolean;
  className?: string;
  /** Provider locked by task (has existing sessions). Only models from this provider are selectable. */
  lockedProviderId?: string;
}

// Icon mapping for providers
const PROVIDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'claude-sdk': Sparkles,
  'gemini-cli': Zap,
};

// Icon mapping for models (by pattern)
function getModelIcon(modelId: string): React.ComponentType<{ className?: string }> {
  if (modelId.includes('opus') || modelId.includes('pro')) return Brain;
  if (modelId.includes('sonnet') || modelId.includes('flash')) return Zap;
  return Sparkles;
}

export function ModelSelector({
  selectedProviderId,
  selectedModelId,
  onSelect,
  disabled = false,
  className,
  lockedProviderId,
}: ModelSelectorProps) {
  const { providers, defaultProviderId, fetchProviders, getProvider, getDefaultModel, isProviderModelsFromCache } = useProvidersStore();
  const getNextModalZIndex = useZIndexStore((state) => state.getNextModalZIndex);
  const [isOpen, setIsOpen] = useState(false);
  const [popupZIndex, setPopupZIndex] = useState(10000);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Fetch providers on mount
  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // Calculate popup position based on button position
  const updatePopupPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    // Position above the button, right-aligned
    setPopupPosition({
      top: rect.top - 4, // 4px gap above button
      left: rect.right, // Right edge aligned
    });
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        popupRef.current && !popupRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleScroll = (e: Event) => {
      // Don't reposition if scrolling inside the popup itself
      if (popupRef.current?.contains(e.target as Node)) {
        return;
      }
      updatePopupPosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', updatePopupPosition);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', updatePopupPosition);
    };
  }, [isOpen, updatePopupPosition]);

  // Handle opening popup - get next z-index and calculate position
  // Add extra offset (+10) to ensure popup is above any modal dialogs
  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      setPopupZIndex(getNextModalZIndex() + 10);
      updatePopupPosition();
    }
    setIsOpen(!isOpen);
  };

  // Determine current selection
  const currentProviderId = selectedProviderId || defaultProviderId || 'claude-sdk';
  const currentProvider = getProvider(currentProviderId);
  const currentModelId = selectedModelId || getDefaultModel(currentProviderId)?.id || '';
  const currentModel = currentProvider?.models.find((m) => m.id === currentModelId);

  // Get available providers
  // When locked to a provider, only show that provider's models
  const availableProviders = lockedProviderId
    ? providers.filter((p) => p.available && p.id === lockedProviderId)
    : providers.filter((p) => p.available);

  // Check if provider is locked (task has existing sessions)
  const isProviderLocked = !!lockedProviderId;

  const handleSelect = (providerId: string, modelId: string) => {
    onSelect(providerId, modelId);
    setIsOpen(false);
  };

  const ProviderIcon = PROVIDER_ICONS[currentProviderId] || Sparkles;

  // Popup content rendered via Portal
  const popupContent = isOpen && typeof document !== 'undefined' ? createPortal(
    <div
      ref={popupRef}
      className="fixed min-w-[220px] bg-popover border rounded-lg shadow-xl py-1 max-h-[300px] overflow-y-auto pointer-events-auto"
      style={{
        zIndex: popupZIndex,
        top: popupPosition.top,
        left: popupPosition.left,
        transform: 'translate(-100%, -100%)', // Position above and to the left (right-aligned)
      }}
      onWheel={(e) => e.stopPropagation()}
    >
      {availableProviders.length === 0 ? (
        <div className="px-3 py-2 text-sm text-muted-foreground">No providers available</div>
      ) : (
        availableProviders.map((provider) => {
          const isCached = isProviderModelsFromCache(provider.id);
          return (
            <div key={provider.id}>
              {/* Provider header */}
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  {provider.name}
                  {isProviderLocked && <Lock className="size-3" />}
                </span>
                {isCached && (
                  <span className="text-[10px] font-normal normal-case text-red-500">
                    Using cached models
                  </span>
                )}
              </div>
              {/* Models */}
              {provider.models.map((model) => {
                const isSelected = provider.id === currentProviderId && model.id === currentModelId;
                const ModelIcon = getModelIcon(model.id);
                return (
                  <button
                    key={`${provider.id}-${model.id}`}
                    type="button"
                    onClick={() => handleSelect(provider.id, model.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors',
                      isSelected && 'bg-accent/50'
                    )}
                  >
                    <ModelIcon className="size-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{model.name}</div>
                      {model.description && (
                        <div className="text-xs text-muted-foreground truncate">{model.description}</div>
                      )}
                    </div>
                    {isSelected && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          );
        })
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
          'hover:bg-muted/80 focus:outline-none focus:ring-1 focus:ring-ring',
          disabled && 'opacity-50 cursor-not-allowed',
          'text-muted-foreground hover:text-foreground'
        )}
        title={`${currentProvider?.name || 'Provider'} - ${currentModel?.name || 'Model'}`}
      >
        <ProviderIcon className="size-3.5" />
        <span className="max-w-[80px] truncate">
          {currentModel?.name || currentModelId || 'Select model'}
        </span>
        <ChevronDown className="size-3 opacity-60" />
      </button>
      {popupContent}
    </div>
  );
}
