import { DiscoveredPlugin, DiscoveredNode } from '@/types/agent-factory';

export interface DiscoveredWithStatus extends DiscoveredPlugin {
  status: 'new' | 'update' | 'current';
  existingPlugin?: {
    id: string;
    sourcePath: string | null;
    updatedAt: number;
  };
}

export interface CompareResponse {
  plugins: DiscoveredWithStatus[];
}

/** Flatten a tree of discovered nodes into a flat list of plugins */
export function flattenTree(nodes: DiscoveredNode[]): DiscoveredPlugin[] {
  const result: DiscoveredPlugin[] = [];
  function traverse(nodes: DiscoveredNode[]) {
    for (const node of nodes) {
      if (node.type === 'folder') {
        traverse(node.children);
      } else {
        result.push(node);
      }
    }
  }
  traverse(nodes);
  return result;
}

/** Get all plugin items in a folder recursively */
export function getAllItemsInFolder(node: DiscoveredNode): DiscoveredPlugin[] {
  if (node.type !== 'folder') return [node];
  const items: DiscoveredPlugin[] = [];
  function traverse(n: DiscoveredNode) {
    if (n.type === 'folder') {
      for (const child of n.children) {
        traverse(child);
      }
    } else {
      items.push(n);
    }
  }
  traverse(node);
  return items;
}

/** Generate a unique key for a discovered node */
export function getNodeKey(node: DiscoveredNode, index: number): string {
  if (node.type === 'folder') {
    return `folder-${node.path}-${index}`;
  }
  return `${node.type}-${node.name}-${node.sourcePath}`;
}
