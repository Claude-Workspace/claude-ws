/**
 * Shared utility functions for plugin type display across agent-factory components.
 * Provides color classes, icons, and labels for plugin types.
 */

import { Folder, FileText, Package } from 'lucide-react';

/** CSS class string for badge/tag coloring by plugin type */
export function getPluginTypeColor(type: string): string {
  switch (type) {
    case 'skill':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'command':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'agent':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'agent_set':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
}

/** Icon element for plugin type */
export function getPluginTypeIcon(type: string): React.ReactElement {
  switch (type) {
    case 'skill':
      return <Folder className="w-4 h-4" />;
    case 'command':
    case 'agent':
      return <FileText className="w-4 h-4" />;
    case 'agent_set':
      return <Package className="w-4 h-4" />;
    default:
      return <Package className="w-4 h-4" />;
  }
}

/** Human-readable label for plugin type */
export function getPluginTypeLabel(type: string): string {
  switch (type) {
    case 'agent_set':
      return 'Agent Set';
    default:
      return type;
  }
}
