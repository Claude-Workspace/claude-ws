'use client';

import { createContext, useContext, useEffect, useCallback, type ReactNode } from 'react';
import { useSidebarStore } from '@/stores/sidebar-store';

interface SearchContextValue {
  toggleSearch: () => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within SearchProvider');
  }
  return context;
}

interface SearchProviderProps {
  children: ReactNode;
}

export function SearchProvider({ children }: SearchProviderProps) {
  const { isOpen, setIsOpen, activeTab, setActiveTab } = useSidebarStore();

  // Toggle search: open & focus if closed, close if already focused
  const toggleSearch = useCallback(() => {
    const searchInput = document.querySelector('[data-slot="unified-search-input"]') as HTMLInputElement;
    const isSearchFocused = document.activeElement === searchInput;

    // If sidebar open, on files tab, and search is focused -> close
    if (isOpen && activeTab === 'files' && isSearchFocused) {
      setIsOpen(false);
      return;
    }

    // Otherwise -> open and focus search
    setIsOpen(true);
    setActiveTab('files');
    setTimeout(() => {
      const input = document.querySelector('[data-slot="unified-search-input"]') as HTMLInputElement;
      input?.focus();
    }, 100);
  }, [isOpen, activeTab, setIsOpen, setActiveTab]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd+P, Cmd+K, or Cmd+Shift+F - Toggle search
      if (cmdKey && (e.key === 'p' || e.key === 'k') && !e.shiftKey) {
        e.preventDefault();
        toggleSearch();
        return;
      }

      if (cmdKey && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        toggleSearch();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSearch]);

  const value: SearchContextValue = {
    toggleSearch,
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}
