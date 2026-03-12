'use client';

import { RefObject } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

type TranslationFn = ReturnType<typeof useTranslations>;

interface FileTabSearchBarProps {
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  currentMatch: number;
  totalMatches: number;
  handleSearch: (query: string) => void;
  handleNextMatch: () => void;
  handlePrevMatch: () => void;
  closeSearch: () => void;
  t: TranslationFn;
  tCommon: TranslationFn;
}

/**
 * FileTabSearchBar - In-editor search bar shown below the toolbar when search is active.
 * Supports next/prev match navigation via Enter / Shift+Enter and Escape to close.
 */
export function FileTabSearchBar({
  searchInputRef,
  searchQuery,
  currentMatch,
  totalMatches,
  handleSearch,
  handleNextMatch,
  handlePrevMatch,
  closeSearch,
  t,
  tCommon,
}: FileTabSearchBarProps) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 border-b bg-accent/30 min-w-0">
      <Search className="size-4 text-muted-foreground shrink-0" />
      <input
        ref={searchInputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (e.shiftKey) handlePrevMatch();
            else handleNextMatch();
          } else if (e.key === 'Escape') {
            closeSearch();
          }
        }}
        placeholder={t('searchPlaceholder')}
        className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
      />
      {searchQuery && (
        <>
          <span className="text-xs text-muted-foreground shrink-0">
            {currentMatch}/{totalMatches}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handlePrevMatch}
            disabled={totalMatches === 0}
            title={t('previousMatch') + ' (⇧Enter)'}
            className="shrink-0"
          >
            <span className="text-xs">↑</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleNextMatch}
            disabled={totalMatches === 0}
            title={t('nextMatch') + ' (Enter)'}
            className="shrink-0"
          >
            <span className="text-xs">↓</span>
          </Button>
        </>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={closeSearch}
        title={tCommon('close') + ' (Esc)'}
        className="shrink-0"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
