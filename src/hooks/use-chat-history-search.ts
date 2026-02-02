import { useState, useEffect, useRef } from 'react';
import { useProjectStore } from '@/stores/project-store';
import { createLogger } from '@/lib/logger';

const log = createLogger('ChatHistoryHook');

/**
 * Match info for a task's chat history search result.
 */
export interface ChatHistoryMatch {
  taskId: string;
  matchedText: string;
  source: 'prompt' | 'assistant';
  attemptId: string;
}

/**
 * Hook to search chat history across tasks.
 * Debounces the search query and fetches matches from the API.
 */
export function useChatHistorySearch(searchQuery: string) {
  const [matches, setMatches] = useState<Map<string, ChatHistoryMatch>>(new Map());
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { selectedProjectIds } = useProjectStore();

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    // Clear matches if query is too short
    if (trimmedQuery.length < 2) {
      setMatches(new Map());
      return;
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Debounce search
    const timeoutId = setTimeout(async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setLoading(true);

      try {
        const params = new URLSearchParams({ q: trimmedQuery });

        if (selectedProjectIds.length > 0) {
          params.set('projectIds', selectedProjectIds.join(','));
        }

        const response = await fetch(`/api/search/chat-history?${params}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to search chat history');
        }

        const data = await response.json();
        const matchMap = new Map<string, ChatHistoryMatch>();

        for (const match of data.matches || []) {
          matchMap.set(match.taskId, match);
        }

        setMatches(matchMap);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          log.error({ error }, 'Chat history search error');
        }
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    return () => {
      clearTimeout(timeoutId);
    };
  }, [searchQuery, selectedProjectIds]);

  return { matches, loading };
}
