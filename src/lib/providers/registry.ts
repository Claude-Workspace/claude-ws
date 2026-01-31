/**
 * Provider Registry - Central management for LLM provider adapters
 *
 * Factory pattern implementation for dynamic provider discovery,
 * instantiation, and selection based on project/task configuration.
 */

import type {
  LLMProviderAdapter,
  ProviderConfig,
  ProviderInfo,
} from './types';
import { ClaudeSDKAdapter, PROVIDER_ID as CLAUDE_SDK_ID, isClaudeModelsFromCache } from './claude-sdk';
import { GeminiCLIAdapter, PROVIDER_ID as GEMINI_CLI_ID, isGeminiInstalled, isModelsFromCache } from './gemini-cli';

/**
 * Default provider ID (fallback when none specified)
 */
export const DEFAULT_PROVIDER_ID = CLAUDE_SDK_ID;

/**
 * Provider Registry - Singleton managing all registered adapters
 */
class ProviderRegistry {
  private adapters = new Map<string, LLMProviderAdapter>();
  private defaultProviderId: string = DEFAULT_PROVIDER_ID;

  /**
   * Register a provider adapter
   */
  register(adapter: LLMProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
    console.log(`[ProviderRegistry] Registered provider: ${adapter.id}`);
  }

  /**
   * Get a provider by ID
   * @throws Error if provider not found
   */
  get(id: string): LLMProviderAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new Error(`Provider not found: ${id}`);
    }
    return adapter;
  }

  /**
   * Get a provider by ID, or undefined if not found
   */
  tryGet(id: string): LLMProviderAdapter | undefined {
    return this.adapters.get(id);
  }

  /**
   * Get the default provider
   */
  getDefault(): LLMProviderAdapter {
    return this.get(this.defaultProviderId);
  }

  /**
   * Set the default provider ID
   */
  setDefault(id: string): void {
    if (!this.adapters.has(id)) {
      throw new Error(`Cannot set default: provider ${id} not registered`);
    }
    this.defaultProviderId = id;
  }

  /**
   * Check if a provider is registered
   */
  has(id: string): boolean {
    return this.adapters.has(id);
  }

  /**
   * List all registered provider IDs
   */
  list(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * List providers with availability info (for UI)
   */
  async listWithInfo(): Promise<ProviderInfo[]> {
    const infos: ProviderInfo[] = [];

    for (const adapter of this.adapters.values()) {
      const availability = this.checkAvailability(adapter.id);
      const models = await adapter.getModels();

      // Check if models are from cache (provider-specific)
      let modelsFromCache = false;
      if (adapter.id === CLAUDE_SDK_ID) {
        modelsFromCache = isClaudeModelsFromCache();
      } else if (adapter.id === GEMINI_CLI_ID) {
        modelsFromCache = isModelsFromCache();
      }

      infos.push({
        id: adapter.id,
        name: adapter.name,
        available: availability.available,
        reason: availability.reason,
        capabilities: adapter.capabilities,
        models,
        modelsFromCache,
      });
    }

    return infos;
  }

  /**
   * Check if a provider is available
   */
  checkAvailability(id: string): { available: boolean; reason?: string } {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      return { available: false, reason: 'Provider not registered' };
    }

    // Provider-specific availability checks
    switch (id) {
      case CLAUDE_SDK_ID:
        // Claude SDK is always available (bundled dependency)
        return { available: true };

      case GEMINI_CLI_ID:
        // Check if Gemini CLI is installed
        return isGeminiInstalled()
          ? { available: true }
          : { available: false, reason: 'Gemini CLI not installed' };

      default:
        // Unknown providers assumed available if registered
        return { available: true };
    }
  }

  /**
   * Get count of registered providers
   */
  get size(): number {
    return this.adapters.size;
  }

  /**
   * Clear all registered providers
   */
  clear(): void {
    this.adapters.clear();
  }
}

// Singleton instance
let registryInstance: ProviderRegistry | null = null;

/**
 * Get the provider registry singleton
 */
export function getProviderRegistry(): ProviderRegistry {
  if (!registryInstance) {
    registryInstance = new ProviderRegistry();
  }
  return registryInstance;
}

/**
 * Initialize providers with default configuration
 * Call once at application startup
 */
export function initializeProviders(_config?: ProviderConfig): void {
  const registry = getProviderRegistry();

  // Skip if already initialized
  if (registry.size > 0) {
    return;
  }

  // Register Claude SDK adapter (always available)
  registry.register(new ClaudeSDKAdapter());

  // Register Gemini CLI adapter (may not be installed)
  registry.register(new GeminiCLIAdapter());

  console.log(`[ProviderRegistry] Initialized ${registry.size} providers`);

  // Log availability (async, but don't block initialization)
  registry.listWithInfo().then((infos) => {
    for (const info of infos) {
      const status = info.available ? '✓' : `✗ (${info.reason})`;
      console.log(`[ProviderRegistry]   ${info.id}: ${status}`);
    }
  });
}

/**
 * Resolve provider ID from resolution chain
 * Priority: query override > task setting > project setting > default
 */
export function resolveProviderId(options: {
  queryProviderId?: string | null;
  taskProviderId?: string | null;
  projectProviderId?: string | null;
}): string {
  const registry = getProviderRegistry();

  // Check each level in priority order
  const candidates = [
    options.queryProviderId,
    options.taskProviderId,
    options.projectProviderId,
  ];

  for (const id of candidates) {
    if (id && registry.has(id)) {
      const availability = registry.checkAvailability(id);
      if (availability.available) {
        return id;
      }
      console.warn(
        `[ProviderRegistry] Provider ${id} not available: ${availability.reason}`
      );
    }
  }

  // Fall back to default
  return registry.getDefault().id;
}
