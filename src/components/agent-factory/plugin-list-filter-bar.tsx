'use client';

/**
 * Filter bar for the plugin list — type filter tabs (all/skill/command/agent/agent_set)
 * and a search input field.
 */

import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

type PluginTypeFilter = 'all' | 'skill' | 'command' | 'agent' | 'agent_set';

interface PluginListFilterBarProps {
  filter: PluginTypeFilter;
  searchQuery: string;
  onFilterChange: (filter: PluginTypeFilter) => void;
  onSearchChange: (query: string) => void;
}

export function PluginListFilterBar({
  filter,
  searchQuery,
  onFilterChange,
  onSearchChange,
}: PluginListFilterBarProps) {
  const t = useTranslations('agentFactory');

  const filterLabels: Record<PluginTypeFilter, string> = {
    all: t('all'),
    skill: t('skills'),
    command: t('commands'),
    agent: t('agents'),
    agent_set: t('agentSets'),
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex gap-2 flex-wrap">
        {(['all', 'skill', 'command', 'agent', 'agent_set'] as const).map((type) => (
          <button
            key={type}
            onClick={() => onFilterChange(type)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === type
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            {filterLabels[type]}
          </button>
        ))}
      </div>
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('searchPlugins')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
    </div>
  );
}
