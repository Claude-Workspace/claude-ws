/**
 * Shared model definitions for chat model selector
 * Used by API, store, and UI components
 */

export interface Model {
  id: string;
  name: string;
  description?: string;
  tier: 'opus' | 'sonnet' | 'haiku';
}

// Available Claude models - single source of truth
// Model IDs from: https://platform.claude.com/docs/en/about-claude/models/overview
export const AVAILABLE_MODELS: Model[] = [
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    description: 'Most capable model',
    tier: 'opus',
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    description: 'Best speed/intelligence balance',
    tier: 'sonnet',
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    description: 'Fastest model',
    tier: 'haiku',
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    description: 'Previous Sonnet model',
    tier: 'sonnet',
  },
];

// Default model ID (fallback when no env/cache)
export const DEFAULT_MODEL_ID = 'claude-opus-4-6';

// SDK model alias (used by agent-manager)
export const DEFAULT_MODEL_ALIAS = 'opus';

// Get model by ID
export function getModelById(id: string): Model | undefined {
  return AVAILABLE_MODELS.find((m) => m.id === id);
}

// Validate model ID against available models
export function isValidModelId(id: string): boolean {
  return AVAILABLE_MODELS.some((m) => m.id === id);
}

/**
 * Convert model ID to display name dynamically
 * Examples:
 *   gemini-claude-sonnet-4-5-thinking -> Gemini Claude Sonnet 4.5 Thinking
 *   claude-opus-4-5-20251101 -> Claude Opus 4.5
 *   my-custom-model-1-0 -> My Custom Model 1.0
 */
export function modelIdToDisplayName(id: string): string {
  // First check if it's a known model
  const known = getModelById(id);
  if (known) return known.name;

  // Remove date suffix patterns like -20251101, -20241022
  const withoutDate = id.replace(/-\d{8}$/, '');

  // Split by hyphen and process each part
  const parts = withoutDate.split('-');
  const result: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // Check if this part and next form a version number (e.g., "4" + "5" -> "4.5")
    if (i < parts.length - 1 && /^\d+$/.test(part) && /^\d+$/.test(parts[i + 1])) {
      // Check if next part is also a number (not followed by another number)
      const nextNext = parts[i + 2];
      if (!nextNext || !/^\d+$/.test(nextNext)) {
        result.push(`${part}.${parts[i + 1]}`);
        i++; // Skip next part
        continue;
      }
    }

    // Capitalize first letter of each word
    result.push(part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
  }

  return result.join(' ');
}

// Get display name for model (max 25 chars)
export function getModelShortName(id: string): string {
  const model = getModelById(id);
  const name = model ? model.name : modelIdToDisplayName(id);
  return name.length > 25 ? name.slice(0, 22) + '...' : name;
}
