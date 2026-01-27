import { create } from 'zustand';
import type { Plugin, CreatePluginDTO, UpdatePluginDTO, DiscoveredPlugin, DiscoveredNode } from '@/types/agent-factory';

// Refs for preventing duplicate fetches (outside store to persist across renders)
const fetchPluginsRefs = {
  isFetching: false,
  lastType: null as string | null,
};

const discoverPluginsRefs = {
  isDiscovering: false,
};

interface AgentFactoryState {
  plugins: Plugin[];
  loading: boolean;
  error: string | null;
  discovered: DiscoveredNode[];
  discovering: boolean;
}

interface AgentFactoryActions {
  // Plugin CRUD
  fetchPlugins: (type?: 'skill' | 'command' | 'agent') => Promise<void>;
  createPlugin: (data: CreatePluginDTO) => Promise<Plugin>;
  updatePlugin: (id: string, data: UpdatePluginDTO) => Promise<void>;
  deletePlugin: (id: string) => Promise<void>;

  // Discovery
  discoverPlugins: () => Promise<DiscoveredNode[]>;
  importPlugin: (discovered: DiscoveredPlugin) => Promise<Plugin>;
}

type AgentFactoryStore = AgentFactoryState & AgentFactoryActions;

export const useAgentFactoryStore = create<AgentFactoryStore>()((set, get) => ({
  // Initial state
  plugins: [],
  loading: true,
  error: null,
  discovered: [],
  discovering: false,

  // Fetch all plugins or filter by type
  fetchPlugins: async (type) => {
    // Prevent duplicate fetches
    const typeKey = type || 'all';
    if (fetchPluginsRefs.isFetching && fetchPluginsRefs.lastType === typeKey) {
      return;
    }

    fetchPluginsRefs.isFetching = true;
    fetchPluginsRefs.lastType = typeKey;
    set({ loading: true, error: null });

    try {
      const url = type ? `/api/agent-factory/plugins?type=${type}` : '/api/agent-factory/plugins';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch plugins');
      const data = await res.json();
      set({ plugins: data.plugins, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch plugins',
        loading: false,
      });
    } finally {
      fetchPluginsRefs.isFetching = false;
    }
  },

  // Create new plugin
  createPlugin: async (data) => {
    set({ error: null });
    try {
      const res = await fetch('/api/agent-factory/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create plugin');
      }
      const result = await res.json();
      const newPlugins = [...get().plugins, result.plugin];
      set({ plugins: newPlugins });
      return result.plugin;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create plugin';
      set({ error: errorMsg });
      throw new Error(errorMsg);
    }
  },

  // Update plugin
  updatePlugin: async (id, data) => {
    set({ error: null });
    try {
      const res = await fetch(`/api/agent-factory/plugins/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update plugin');
      }
      const result = await res.json();
      const updatedPlugins = get().plugins.map((p) =>
        p.id === id ? result.plugin : p
      );
      set({ plugins: updatedPlugins });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update plugin',
      });
      throw error;
    }
  },

  // Delete plugin
  deletePlugin: async (id) => {
    set({ error: null });
    try {
      const res = await fetch(`/api/agent-factory/plugins/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete plugin');
      }
      const updatedPlugins = get().plugins.filter((p) => p.id !== id);
      set({ plugins: updatedPlugins });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete plugin',
      });
      throw error;
    }
  },

  // Discover plugins from filesystem
  discoverPlugins: async () => {
    set({ discovering: true, error: null });
    try {
      const res = await fetch('/api/agent-factory/discover', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to discover plugins');
      const data = await res.json();
      set({ discovered: data.discovered, discovering: false });
      return data.discovered;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to discover plugins',
        discovering: false,
      });
      return [];
    }
  },

  // Import discovered plugin
  importPlugin: async (discovered) => {
    set({ error: null });
    try {
      const res = await fetch('/api/agent-factory/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discovered),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to import plugin');
      }
      const result = await res.json();
      const newPlugins = [...get().plugins, result.plugin];
      set({ plugins: newPlugins });
      return result.plugin;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to import plugin';
      set({ error: errorMsg });
      throw error;
    }
  },
}));
