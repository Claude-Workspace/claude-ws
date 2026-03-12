'use client';

/**
 * Read-only installation options panel shown during the preview step of the
 * project-settings plugin upload dialog. Explains that plugins are always
 * installed to both the current project and the agent factory.
 */

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export function PluginUploadInstallationOptionsPanel() {
  return (
    <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
      <p className="text-sm font-medium">Installation Options:</p>
      <div className="flex items-start gap-3">
        <Checkbox id="install-to-project" checked={true} disabled={true} />
        <div className="flex-1">
          <Label htmlFor="install-to-project" className="text-sm font-medium">
            Install to this project
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Plugins will be installed to the project&apos;s .claude folder
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <Checkbox id="import-to-factory" checked={true} disabled={true} />
        <div className="flex-1">
          <Label htmlFor="import-to-factory" className="text-sm font-medium">
            Import to Agent Factory
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Plugins are automatically added to your plugin pool for reuse
          </p>
        </div>
      </div>
    </div>
  );
}
