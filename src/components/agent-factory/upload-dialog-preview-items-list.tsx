'use client';

/**
 * Preview list shown before confirming an archive import.
 * Displays each discovered plugin with its type badge, name, and target path.
 */

import { Badge } from '@/components/ui/badge';
import { getPluginTypeColor, getPluginTypeIcon, getPluginTypeLabel } from '@/components/agent-factory/plugin-type-utils';

interface PreviewItem {
  type: 'skill' | 'command' | 'agent' | 'agent_set' | 'unknown';
  name: string;
  targetPath: string;
  pluginCount?: number;
}

interface UploadDialogPreviewItemsListProps {
  items: PreviewItem[];
  /** Label for the header, e.g. "Items to import" or "Items to install" */
  headerLabel: string;
  /** Max height CSS class for the scrollable list, e.g. "max-h-[300px]" */
  maxHeightClass?: string;
}

export function UploadDialogPreviewItemsList({
  items,
  headerLabel,
  maxHeightClass = 'max-h-[300px]',
}: UploadDialogPreviewItemsListProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-3 py-2 text-sm font-medium border-b">
        {headerLabel} ({items.length})
      </div>
      <div className={`${maxHeightClass} overflow-y-auto`}>
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 hover:bg-muted/30"
          >
            {getPluginTypeIcon(item.type)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{item.name}</p>
                {item.type === 'agent_set' && item.pluginCount !== undefined && (
                  <span className="text-xs text-muted-foreground">({item.pluginCount} plugins)</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{item.targetPath}</p>
            </div>
            <Badge className={getPluginTypeColor(item.type)}>
              {getPluginTypeLabel(item.type)}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
