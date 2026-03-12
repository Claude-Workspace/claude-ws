'use client';

/**
 * Single plugin card displayed in the plugin list grid.
 * Shows plugin name, type badge, description, storage type, date, and edit/delete actions.
 */

import { useTranslations } from 'next-intl';
import { Package, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Plugin } from '@/types/agent-factory';
import { getPluginTypeColor, getPluginTypeLabel } from '@/components/agent-factory/plugin-type-utils';

interface PluginListCardProps {
  plugin: Plugin;
  onClick: (plugin: Plugin) => void;
  onEdit: (plugin: Plugin) => void;
  onDelete: (id: string) => void;
}

export function PluginListCard({ plugin, onClick, onEdit, onDelete }: PluginListCardProps) {
  const t = useTranslations('agentFactory');

  return (
    <div
      className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onClick(plugin)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">{plugin.name}</h3>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${getPluginTypeColor(plugin.type)}`}>
          {getPluginTypeLabel(plugin.type)}
        </span>
      </div>
      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
        {plugin.description || t('noDescription')}
      </p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="capitalize">{plugin.storageType}</span>
        <span>•</span>
        <span>{new Date(plugin.createdAt).toLocaleDateString()}</span>
      </div>
      <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onEdit(plugin)}
        >
          <Edit className="w-3 h-3 mr-1" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-destructive hover:text-destructive"
          onClick={() => onDelete(plugin.id)}
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Delete
        </Button>
      </div>
    </div>
  );
}
