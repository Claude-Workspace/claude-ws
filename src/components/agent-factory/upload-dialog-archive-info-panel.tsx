'use client';

/**
 * Informational panel shown on the upload step explaining how archive files
 * are automatically organized into skills/commands/agents folders.
 */

interface UploadDialogArchiveInfoPanelProps {
  automaticOrganizationLabel: string;
}

export function UploadDialogArchiveInfoPanel({
  automaticOrganizationLabel,
}: UploadDialogArchiveInfoPanelProps) {
  return (
    <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
      <p className="font-medium mb-2">{automaticOrganizationLabel}</p>
      <p className="text-xs mb-2">
        Files will be automatically organized into the correct folders:
      </p>
      <ul className="text-xs space-y-1 ml-4">
        <li>• <strong>Skills:</strong> Folders with <code>SKILL.md</code> → <code>skills/</code></li>
        <li>• <strong>Commands:</strong> <code>@command</code> or command-type files → <code>commands/</code></li>
        <li>• <strong>Agents:</strong> <code>@agent</code> or agent-type files → <code>agents/</code></li>
      </ul>
      <p className="text-xs mt-2">
        Pre-organized archives with <code>skills/</code>, <code>commands/</code>, <code>agents/</code> folders are also supported.
      </p>
    </div>
  );
}
