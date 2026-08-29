import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Star, CornerDownLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/core/i18n/context';
import { searchTitlesQuick } from '@/services/comic.service';
import type { Comic } from '@/core/types/comic';
import { cn } from '@/lib/utils/cn';

interface GlobalCommandSearchProps {
  onSelectComic: (comic: Comic) => void;
}

/**
 * The finder.
 *
 * Its anatomy is deliberately untouched by the redesign — trigger with a key
 * hint, portal overlay, one input row, a result list you drive with the arrow
 * keys, a footer legend. That structure was the one part of the old build
 * worth keeping, so only its materials moved into the issue: square corners,
 * paper stock, printed rules, and the spot color marking the row under the
 * cursor.
 */
export function GlobalCommandSearch({ onSelectComic }: GlobalCommandSearchProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Comic[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Global Shortcut: ONLY Ctrl+K or Cmd+K opens the Spotlight modal (releasing '/' for in-page search bar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Real-time Elastic Debounce Search (50ms)
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const matches = await searchTitlesQuick(query.trim(), 8);
        setResults(matches);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Elastic search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [query]);

  // Arrow Keys & Enter Navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = results[selectedIndex];
      if (selected) {
        onSelectComic(selected);
        setIsOpen(false);
      }
    }
  };

  return (
    <>
      {/* Masthead trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="stamp group flex items-center gap-2 px-2 sm:px-2.5 py-1.5 text-[10px] border border-[var(--rule)] bg-[var(--paper-sheet)] text-[var(--ink-soft)] hover:border-[var(--ink)] hover:text-[var(--ink)] transition-colors cursor-pointer"
        title="Find a title (Ctrl+K)"
      >
        <Search className="w-3.5 h-3.5 group-hover:text-[var(--spot-text)] transition-colors" />
        <span className="hidden md:inline">{t.spotlight.quickSearch}</span>
        <span className="figures px-1 py-px border border-[var(--rule)] text-[9px] leading-none text-[var(--ink-faint)]">
          ⌘K
        </span>
      </button>

      {/* The finder, as an overlaid sheet */}
      {isOpen &&
        createPortal(
          <div
            onClick={(e) => {
              if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                setIsOpen(false);
              }
            }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-[color-mix(in_oklab,var(--ink)_72%,transparent)] animate-in fade-in duration-150"
            style={{ ['--spot' as string]: 'var(--ink-magenta)' }}
          >
            <div
              ref={modalRef}
              className="w-full max-w-2xl bg-[var(--paper-sheet)] border-2 border-[var(--ink)] shadow-[var(--lift-shadow)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
            >
              {/* Input row */}
              <div className="relative flex items-center gap-3 px-4 py-3.5 border-b-2 border-[var(--ink)] focus-within:border-[var(--spot)] transition-colors">
                <Search className="w-4 h-4 text-[var(--ink-faint)] shrink-0" />

                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t.spotlight.placeholder}
                  className="w-full bg-transparent text-base sm:text-lg font-medium text-[var(--ink)] placeholder-[var(--ink-faint)] focus:outline-none"
                />

                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="p-1 text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors cursor-pointer shrink-0"
                    aria-label="Clear"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <kbd className="stamp px-1.5 py-0.5 text-[9px] border border-[var(--rule)] text-[var(--ink-faint)] shrink-0">
                    ESC
                  </kbd>
                )}

                {/* The roller runs while the query is out. */}
                {isLoading && <span className="press-bar" aria-hidden />}
              </div>

              {/* Results */}
              <div className="max-h-[380px] overflow-y-auto">
                {results.length > 0 ? (
                  results.map((comic, idx) => {
                    const isSelected = idx === selectedIndex;
                    const typeVariant =
                      comic.type === 'MANHWA' ? 'manhwa' : comic.type === 'MANGA' ? 'manga' : 'manhua';

                    return (
                      <div
                        key={comic.id}
                        onClick={() => {
                          onSelectComic(comic);
                          setIsOpen(false);
                        }}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={cn(
                          'flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer transition-colors select-none border-b border-[var(--rule)] last:border-b-0',
                          isSelected
                            ? 'bg-[var(--spot-wash)]'
                            : 'hover:bg-[var(--paper-deep)]'
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* The cursor is a printed bar in the margin, not a ring. */}
                          <span
                            className={cn(
                              'w-[3px] self-stretch shrink-0 transition-colors',
                              isSelected ? 'bg-[var(--spot)]' : 'bg-transparent'
                            )}
                            aria-hidden
                          />

                          {comic.cover_image_url ? (
                            <img
                              src={comic.cover_image_url}
                              alt=""
                              className="w-9 aspect-[3/4] object-cover shrink-0 bg-[var(--paper-plate)]"
                            />
                          ) : (
                            <div className="w-9 aspect-[3/4] bg-[var(--paper-plate)] shrink-0" />
                          )}

                          <div className="flex flex-col min-w-0 gap-1">
                            <span className="text-sm font-semibold text-[var(--ink)] truncate leading-tight">
                              {comic.title_english || comic.title_romaji}
                            </span>
                            <div className="flex items-center gap-2">
                              <Badge variant={typeVariant}>{comic.type}</Badge>
                              {comic.average_score && (
                                <span className="stamp figures flex items-center gap-0.5 text-[9px] text-[var(--ink-gold)]">
                                  <Star className="w-2.5 h-2.5 fill-current" />
                                  {(comic.average_score / 10).toFixed(1)}
                                </span>
                              )}
                              <span className="stamp figures text-[9px] text-[var(--ink-faint)]">
                                {comic.total_chapters ? `${comic.total_chapters} ch` : t.common.ongoing}
                              </span>
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="stamp flex items-center gap-1 text-[9px] text-[var(--spot-text)] shrink-0">
                            <span>{t.spotlight.open}</span>
                            <CornerDownLeft className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    );
                  })
                ) : query.trim() ? (
                  <p className="py-10 px-4 text-center text-xs text-[var(--ink-faint)]">
                    {t.spotlight.noResults(query)}
                  </p>
                ) : (
                  <div className="py-9 px-6 flex flex-col gap-2 text-center">
                    <p className="text-sm text-[var(--ink-soft)] leading-relaxed">
                      {t.spotlight.emptyTitle}
                    </p>
                    <p className="stamp text-[9px] text-[var(--ink-faint)]">
                      {t.spotlight.emptyHint}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer legend */}
              <div className="stamp flex items-center justify-between gap-3 px-4 py-2 bg-[var(--ink)] text-[var(--paper)] text-[9px]">
                <div className="flex items-center gap-3">
                  <span>↑↓ {t.spotlight.nav}</span>
                  <span>↵ {t.spotlight.select}</span>
                  <span className="hidden sm:inline">ESC {t.spotlight.close}</span>
                </div>
                <span className="text-[var(--paper)] opacity-70">{t.spotlight.badge}</span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
