'use client';

import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronDown, AlertTriangle, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

export interface DependencyTreeNode {
  type: 'skill' | 'command' | 'agent';
  name: string;
  depth: number;
  cycle?: boolean;
  missing?: boolean;
  truncated?: boolean;
  children?: DependencyTreeNode[];
}

interface DependencyTreeProps {
  nodes: DependencyTreeNode[];
}

export function DependencyTree({ nodes }: DependencyTreeProps) {
  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <TreeNode key={`${node.type}-${node.name}-${node.depth}`} node={node} />
      ))}
    </div>
  );
}

function TreeNode({ node }: { node: DependencyTreeNode }) {
  const t = useTranslations('agentFactory');
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'skill':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'command':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'agent':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1 px-2 rounded hover:bg-muted cursor-pointer`}
        style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          )
        ) : (
          <span className="w-3 h-3" />
        )}

        <Badge className={getTypeColor(node.type)}>{node.type}</Badge>
        <span className="text-sm">{node.name}</span>

        {node.cycle && (
          <Badge variant="outline" className="text-orange-500 border-orange-500 text-xs">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {t('cycle')}
          </Badge>
        )}

        {node.missing && (
          <Badge variant="outline" className="text-red-500 border-red-500 text-xs">
            <AlertCircle className="w-3 h-3 mr-1" />
            {t('missing')}
          </Badge>
        )}

        {node.truncated && (
          <Badge variant="outline" className="text-gray-500 text-xs">
            {t('maxDepth')}
          </Badge>
        )}

        {node.depth > 0 && (
          <span className="text-xs text-muted-foreground">L{node.depth}</span>
        )}
      </div>

      {hasChildren && expanded && (
        <DependencyTree nodes={node.children!} />
      )}
    </div>
  );
}

export function countPlugins(nodes: DependencyTreeNode[]): number {
  let count = nodes.length;
  for (const node of nodes) {
    if (node.children) {
      count += countPlugins(node.children);
    }
  }
  return count;
}
