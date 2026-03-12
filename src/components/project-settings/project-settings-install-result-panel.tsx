'use client';

import { CheckCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface InstallResult {
  installed: string[];
  skipped: string[];
  errors: string[];
}

interface ProjectSettingsInstallResultPanelProps {
  installResult: InstallResult;
}

/**
 * Read-only panel displayed after a component installation run inside ProjectSettingsDialog.
 * Shows installed, skipped, and error counts with scrollable item lists.
 */
export function ProjectSettingsInstallResultPanel({
  installResult,
}: ProjectSettingsInstallResultPanelProps) {
  return (
    <div className="space-y-3 p-4 bg-muted rounded-lg">
      <div className="flex items-center gap-2">
        <CheckCircle className="h-5 w-5 text-green-600" />
        <span className="font-medium">Installation Complete</span>
      </div>

      {installResult.installed.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-green-700">
            Installed ({installResult.installed.length})
          </p>
          <ScrollArea className="h-24 border rounded-md p-2">
            <ul className="text-xs space-y-1">
              {installResult.installed.map((item, i) => (
                <li key={i} className="text-muted-foreground">• {item}</li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      )}

      {installResult.errors.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-red-700">
            Errors ({installResult.errors.length})
          </p>
          <ScrollArea className="h-24 border rounded-md p-2 bg-red-50">
            <ul className="text-xs space-y-1">
              {installResult.errors.map((item, i) => (
                <li key={i} className="text-red-600">• {item}</li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      )}

      {installResult.skipped.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-yellow-700">
            Skipped ({installResult.skipped.length})
          </p>
          <ul className="text-xs space-y-1">
            {installResult.skipped.map((item, i) => (
              <li key={i} className="text-muted-foreground">• {item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
