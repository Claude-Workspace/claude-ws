/**
 * Provider Select Component - Dropdown for selecting LLM provider
 *
 * Fetches available providers and displays availability status.
 * Used in project settings and task header for provider selection.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { fetchWithAuth } from '@/lib/fetch-with-auth';

interface ProviderCapabilities {
  streaming: boolean;
  sessionResume: boolean;
  toolCalling: boolean;
  mcpSupport: boolean;
  thinkingBlocks: boolean;
  maxContextTokens: number;
}

interface ProviderInfo {
  id: string;
  name: string;
  available: boolean;
  reason?: string;
  capabilities: ProviderCapabilities;
}

interface ProviderSelectProps {
  /** Current selected provider ID (null = use default/inherit) */
  value: string | null;
  /** Callback when provider changes */
  onChange: (providerId: string | null) => void;
  /** Show "Inherit from project" option (for task-level) */
  showInherit?: boolean;
  /** Disable the dropdown */
  disabled?: boolean;
  /** Compact mode for inline display */
  compact?: boolean;
}

export function ProviderSelect({
  value,
  onChange,
  showInherit = false,
  disabled = false,
  compact = false,
}: ProviderSelectProps) {
  const t = useTranslations('providers');
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [defaultId, setDefaultId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchWithAuth('/api/providers');
      if (!res.ok) throw new Error('Failed to fetch providers');
      const data = await res.json();
      setProviders(data.providers);
      setDefaultId(data.defaultId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // Format context tokens for display
  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    return `${Math.round(tokens / 1000)}K`;
  };

  if (loading) {
    return (
      <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${compact ? 'h-8 w-32' : 'h-10 w-full'}`} />
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-sm">
        {error}
        <button onClick={fetchProviders} className="ml-2 underline">
          Retry
        </button>
      </div>
    );
  }

  const selectedProvider = providers.find(p => p.id === value);

  return (
    <div className={compact ? 'inline-flex items-center gap-2' : 'space-y-2'}>
      {!compact && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('label')}
        </label>
      )}
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        disabled={disabled}
        className={`
          rounded-md border-gray-300 dark:border-gray-600
          bg-white dark:bg-gray-800
          text-gray-900 dark:text-gray-100
          shadow-sm focus:border-indigo-500 focus:ring-indigo-500
          disabled:opacity-50 disabled:cursor-not-allowed
          ${compact ? 'text-sm py-1 px-2' : 'block w-full sm:text-sm py-2 px-3'}
        `}
      >
        {showInherit ? (
          <option value="">{t('inheritFromProject')}</option>
        ) : (
          <option value="">
            {t('useDefault')} ({defaultId})
          </option>
        )}
        {providers.map(provider => (
          <option
            key={provider.id}
            value={provider.id}
            disabled={!provider.available}
          >
            {provider.name}
            {!provider.available && ` (${provider.reason || t('unavailable')})`}
            {provider.available && ` - ${formatTokens(provider.capabilities.maxContextTokens)} ${t('tokens')}`}
          </option>
        ))}
      </select>

      {/* Show selected provider capabilities (non-compact mode) */}
      {!compact && selectedProvider && selectedProvider.available && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selectedProvider.capabilities.streaming && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
              {t('capabilities.streaming')}
            </span>
          )}
          {selectedProvider.capabilities.thinkingBlocks && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
              {t('capabilities.thinkingBlocks')}
            </span>
          )}
          {selectedProvider.capabilities.mcpSupport && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
              {t('capabilities.mcpSupport')}
            </span>
          )}
          {selectedProvider.capabilities.sessionResume && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
              {t('capabilities.sessionResume')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default ProviderSelect;
