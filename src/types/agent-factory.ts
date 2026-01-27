// Agent Factory types for plugin management

export type PluginType = 'skill' | 'command' | 'agent' | 'agent_set';
export type StorageType = 'local' | 'imported' | 'external';
export type DependencyType = 'python' | 'npm' | 'system' | 'skill' | 'agent';

export interface Plugin {
  id: string;
  type: PluginType;
  name: string;
  description?: string | null;
  sourcePath?: string | null; // null for agent_set
  storageType: StorageType;
  agentSetPath?: string | null; // For agent sets: path to the agent set folder
  metadata?: string | null; // JSON string
  createdAt: number;
  updatedAt: number;
}

export interface PluginFile {
  type: PluginType;
  name: string;
  path: string;
  isDirectory: boolean;
  children?: PluginFile[];
  content?: string; // For file editing
}

// File tree entry for explorer UI (recursive structure)
export interface PluginFileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: PluginFileEntry[];
  size?: number;
  mimeType?: string;
  gitStatus?: 'M' | 'A' | 'D' | 'U' | 'R'; // Optional git status
}

export interface PluginDependency {
  id: string;
  pluginId: string;
  dependencyType: DependencyType;
  spec: string;
  pluginDependencyId?: string | null; // For skill/agent deps
  installed: boolean;
  createdAt: number;
}

export interface DependencyNode {
  dependency: PluginDependency;
  plugin?: Plugin; // For skill/agent deps
  children: DependencyNode[];
  circular?: boolean;
}

export interface DiscoveredPlugin {
  type: PluginType;
  name: string;
  description?: string;
  sourcePath: string;
  group?: string; // Parent folder name for grouping nested commands/agents
  metadata?: Record<string, unknown>;
}

export interface DiscoveredFolder {
  type: 'folder';
  name: string;
  path: string;
  children: DiscoveredNode[];
}

export type DiscoveredNode = DiscoveredFolder | DiscoveredPlugin;

export interface CreatePluginDTO {
  type: PluginType;
  name: string;
  description?: string;
  sourcePath?: string; // Auto-generated if not provided
  storageType?: StorageType;
  metadata?: Record<string, unknown>;
}

export interface UpdatePluginDTO {
  name?: string;
  description?: string;
  sourcePath?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateDependencyDTO {
  pluginId: string;
  dependencyType: DependencyType;
  spec: string;
  pluginDependencyId?: string;
}
