/**
 * Providers Store - Client-side caching for LLM providers
 *
 * Fetches and caches available providers and models on app load.
 */

import { create } from 'zustand';

interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
}

interface ProviderInfo {
  id: string;
  name: string;
  available: boolean;
  reason?: string;
  models: ModelInfo[];
  /** True if models are from cache (fetch failed) */
  modelsFromCache?: boolean;
}

interface ProvidersState {
  providers: ProviderInfo[];
  defaultProviderId: string | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;

  // Actions
  fetchProviders: () => Promise<void>;
  getProvider: (id: string) => ProviderInfo | undefined;
  getAvailableProviders: () => ProviderInfo[];
  getDefaultModel: (providerId: string) => ModelInfo | undefined;
  isProviderModelsFromCache: (providerId: string) => boolean;
  /** Find which provider contains a given model ID */
  findModelProvider: (modelId: string) => { providerId: string; model: ModelInfo } | undefined;
}

export const useProvidersStore = create<ProvidersState>((set, get) => ({
  providers: [],
  defaultProviderId: null,
  isLoading: false,
  error: null,
  lastFetched: null,

  fetchProviders: async () => {
    // Skip if already loading or recently fetched (within 5 minutes)
    const state = get();
    if (state.isLoading) return;
    if (state.lastFetched && Date.now() - state.lastFetched < 5 * 60 * 1000) return;

    set({ isLoading: true, error: null });

    try {
      const response = await fetch('/api/providers');
      if (!response.ok) {
        throw new Error(`Failed to fetch providers: ${response.status}`);
      }

      const data = await response.json();
      set({
        providers: data.providers || [],
        defaultProviderId: data.defaultId || null,
        isLoading: false,
        lastFetched: Date.now(),
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch providers',
      });
    }
  },

  getProvider: (id: string) => {
    return get().providers.find((p) => p.id === id);
  },

  getAvailableProviders: () => {
    return get().providers.filter((p) => p.available);
  },

  getDefaultModel: (providerId: string) => {
    const provider = get().getProvider(providerId);
    if (!provider) return undefined;
    return provider.models.find((m) => m.isDefault) || provider.models[0];
  },

  isProviderModelsFromCache: (providerId: string) => {
    const provider = get().getProvider(providerId);
    return provider?.modelsFromCache ?? false;
  },

  findModelProvider: (modelId: string) => {
    const providers = get().providers;
    for (const provider of providers) {
      if (!provider.available) continue;
      const model = provider.models.find((m) => m.id === modelId);
      if (model) {
        return { providerId: provider.id, model };
      }
    }
    return undefined;
  },
}));
