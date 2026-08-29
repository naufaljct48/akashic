import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Star, CornerDownLeft, Sparkles, Command } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/core/i18n/context';
import { getComics } from '@/services/comic.service';
import type { Comic } from '@/core/types/comic';
import { cn } from '@/lib/utils/cn';

interface GlobalCommandSearchProps {
  onSelectComic: (comic: Comic) => void;
}

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
        const matches = await getComics({ query: query.trim(), limit: 8 });
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
      {/* Navbar Elastic Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] hover:border-[var(--border-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-mono-data transition-all cursor-pointer shadow-2xs group"
        title="Quick Elastic Search (Ctrl+K)"
      >
        <Search className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[#ff334b] transition-colors" />
        <span className="hidden md:inline font-sans text-xs">{t.spotlight.quickSearch}</span>
        <div className="flex items-center gap-0.5 text-[10px] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] font-bold text-[var(--text-muted)]">
          <Command className="w-2.5 h-2.5 hidden md:inline" />
          <span>K</span>
        </div>
      </button>

      {/* Elastic Spotlight Modal Overlay (Clean, full-screen portal backdrop) */}
      {isOpen &&
        createPortal(
          <div
            onClick={(e) => {
              if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                setIsOpen(false);
              }
            }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
          >
            <div
              ref={modalRef}
              className="w-full max-w-2xl rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl shadow-black/40 dark:shadow-black/80 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
            >
              {/* Input Bar */}
              <div className="relative flex items-center px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--input-bg)]">
                {isLoading ? (
                  <Sparkles className="w-5 h-5 text-[#ff334b] animate-spin mr-3 shrink-0" />
                ) : (
                  <Search className="w-5 h-5 text-[var(--text-muted)] mr-3 shrink-0" />
                )}

                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t.spotlight.placeholder}
                  className="w-full bg-transparent text-sm sm:text-base text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none font-jakarta"
                />

                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono-data rounded bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                    ESC
                  </kbd>
                )}
              </div>

              {/* Results List */}
              <div className="max-h-[380px] overflow-y-auto p-2 flex flex-col gap-1">
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
                          'flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors select-none',
                          isSelected
                            ? 'bg-[var(--bg-surface-raised)] text-[var(--text-primary)] ring-1 ring-[#ff334b]/40'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {comic.cover_image_url ? (
                            <img
                              src={comic.cover_image_url}
                              alt={comic.title_english || comic.title_romaji}
                              className="w-10 aspect-[3/4] object-cover rounded-lg shrink-0 bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]"
                            />
                          ) : (
                            <div className="w-10 aspect-[3/4] rounded-lg bg-[var(--bg-surface-raised)] shrink-0" />
                          )}

                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold text-[var(--text-primary)] truncate font-jakarta">
                              {comic.title_english || comic.title_romaji}
                            </span>
                            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-mono-data mt-0.5">
                              <Badge variant={typeVariant}>{comic.type}</Badge>
                              {comic.average_score && (
                                <span className="flex items-center gap-0.5 text-amber-500 font-bold text-[11px]">
                                  <Star className="w-3 h-3 fill-current" />
                                  {(comic.average_score / 10).toFixed(1)}
                                </span>
                              )}
                              <span>{comic.total_chapters ? `${comic.total_chapters} ch` : t.common.ongoing}</span>
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="flex items-center gap-1 text-[11px] font-mono-data text-[var(--text-muted)] shrink-0 ml-2">
                            <span>{t.spotlight.open}</span>
                            <CornerDownLeft className="w-3 h-3 text-[#ff334b]" />
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : query.trim() ? (
                  <div className="py-10 text-center text-xs text-[var(--text-muted)] font-mono-data">
                    {t.spotlight.noResults(query)}
                  </div>
                ) : (
                  <div className="py-8 px-4 flex flex-col gap-2 text-xs font-mono-data text-[var(--text-muted)] text-center">
                    <span>{t.spotlight.emptyTitle}</span>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      {t.spotlight.emptyHint}
                    </span>
                  </div>
                )}
              </div>

              {/* Footer Strip */}
              <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-surface-raised)] border-t border-[var(--border-subtle)] text-[11px] font-mono-data text-[var(--text-muted)]">
                <div className="flex items-center gap-3">
                  <span><kbd className="px-1 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)]">↑↓</kbd> {t.spotlight.nav}</span>
                  <span><kbd className="px-1 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)]">↵</kbd> {t.spotlight.select}</span>
                  <span><kbd className="px-1 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)]">ESC</kbd> {t.spotlight.close}</span>
                </div>
                <span className="text-[#ff334b] font-bold">{t.spotlight.badge}</span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
