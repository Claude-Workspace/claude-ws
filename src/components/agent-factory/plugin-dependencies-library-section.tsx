'use client';

/**
 * Section component showing library (npm/pip/etc.) dependencies for a plugin.
 * Displays badges for each library and an install scripts panel if available.
 */

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { PackageSearch } from 'lucide-react';
import { PluginDetailInstallScriptsPanel, type InstallScripts } from './plugin-detail-install-scripts-panel';

interface LibraryDep {
  name: string;
  version?: string;
  manager: string;
}

interface PluginDependenciesLibrarySectionProps {
  libraries: LibraryDep[];
  installScripts?: InstallScripts;
}

export function PluginDependenciesLibrarySection({
  libraries,
  installScripts,
}: PluginDependenciesLibrarySectionProps) {
  const t = useTranslations('agentFactory');

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <PackageSearch className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">{t('libraryDependencies')}</h3>
        <Badge variant="secondary">{libraries.length}</Badge>
      </div>
      {libraries.length === 0 ? (
        <p className="text-sm text-muted-foreground pl-6">{t('noExternalLibraries')}</p>
      ) : (
        <div className="pl-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            {libraries.map((lib, idx) => (
              <Badge key={idx} variant="outline" className="font-mono text-xs">
                {lib.name}
                {lib.version && <span className="text-muted-foreground">@{lib.version}</span>}
                <span className="text-muted-foreground">({lib.manager})</span>
              </Badge>
            ))}
          </div>
          {installScripts && (
            <PluginDetailInstallScriptsPanel scripts={installScripts} />
          )}
        </div>
      )}
    </div>
  );
}
