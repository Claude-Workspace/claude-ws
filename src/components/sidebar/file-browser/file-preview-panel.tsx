'use client';

/**
 * @deprecated Use FileTabsPanel instead for multi-tab file editing.
 * This component is kept for backward compatibility and redirects to the tab system.
 */

import { useEffect } from 'react';
import { useSidebarStore } from '@/stores/sidebar-store';

export function FilePreviewPanel() {
  // This component is deprecated - the new tab system handles file preview
  // Just return null as FileTabsPanel handles all file editing now
  return null;
}
