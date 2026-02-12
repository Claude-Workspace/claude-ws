import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Wait for an element to appear in the DOM using MutationObserver.
 * More reliable than setTimeout for waiting on dynamic content.
 * @param selector - CSS selector for the target element
 * @param timeout - Max wait time in ms (default: 5000)
 * @returns Promise resolving to the element, or null if timeout
 */
export function waitForElement<T extends Element = Element>(
  selector: string,
  timeout = 5000
): Promise<T | null> {
  return new Promise((resolve) => {
    // Check if element already exists
    const existing = document.querySelector<T>(selector);
    if (existing) {
      return resolve(existing);
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector<T>(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Timeout fallback
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

/**
 * Predefined color palette for distinguishing projects visually.
 * Colors are chosen to be readable on dark backgrounds.
 */
const PROJECT_COLORS = [
  '#F28B82', // red
  '#FCAD70', // orange
  '#FDD663', // yellow
  '#81C995', // green
  '#78D9EC', // cyan
  '#8AB4F8', // blue
  '#C58AF9', // purple
  '#FF8BCB', // pink
];

/**
 * Generate a deterministic color for a project based on its name.
 * Uses a simple string hash to consistently assign the same color to the same project.
 */
export function getProjectColor(projectName: string): string {
  let hash = 0;
  for (let i = 0; i < projectName.length; i++) {
    hash = ((hash << 5) - hash + projectName.charCodeAt(i)) | 0;
  }
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

/**
 * Extract the folder/directory name from a file path.
 * Handles both Unix (/) and Windows (\) path separators.
 * @param path - Full file path
 * @returns The folder/directory name
 */
export function getFolderName(path: string): string {
  if (!path) return '';

  // Normalize path separators to handle both Windows and Unix
  const normalizedPath = path.replace(/\\/g, '/');

  // Remove trailing slash
  const cleanPath = normalizedPath.replace(/\/$/, '');

  // Extract the last segment (folder name)
  const segments = cleanPath.split('/');
  const folderName = segments[segments.length - 1];

  return folderName || path;
}
