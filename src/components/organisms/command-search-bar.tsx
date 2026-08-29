import React, { useRef, useEffect } from 'react';
import { Search, Sparkles, X, CornerDownLeft, Zap, Dices } from 'lucide-react';
import { useI18n } from '@/core/i18n/context';
import type { ComicType } from '@/core/types/comic';
import { cn } from '@/lib/utils/cn';

interface CommandSearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  onSubmit: (q: string) => void;
  selectedType: ComicType | 'ALL';
  onTypeChange: (t: ComicType | 'ALL') => void;
  isLoading: boolean;
  rateLimitRemaining: number;
  maxRateLimit?: number;
  onSurpriseMe?: () => void;
  isRollingGacha?: boolean;
}

export function CommandSearchBar({
  query,
  onQueryChange,
  onSubmit,
  selectedType,
  onTypeChange,
  isLoading,
  rateLimitRemaining,
  maxRateLimit = 10,
  onSurpriseMe,
  isRollingGacha = false,
}: CommandSearchBarProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  // Global '/' keyboard shortcut to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSubmit(query);
    }
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Search Input Bar (Wrapped in Form for 100% reliable submit) */}
      <form
        onSubmit={handleFormSubmit}
        className="relative flex items-center rounded-xl bg-[var(--input-bg)] border border-[var(--border-subtle)] focus-within:border-[var(--text-secondary)] transition-all shadow-xs"
      >
        <div className="pl-3.5 pr-2 text-[var(--text-muted)] flex items-center shrink-0">
          {isLoading ? (
            <Sparkles className="w-4 h-4 text-[#ff334b] animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-[var(--text-muted)]" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t.search.placeholder}
          className="w-full bg-transparent py-3 pr-24 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
        />

        {/* Right Actions inside search */}
        <div className="absolute right-2 flex items-center gap-1.5">
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer"
              title="Clear input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#ff334b] hover:bg-[#e0263c] text-white text-xs font-mono-data font-semibold transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none shadow-xs"
          >
            <span>{t.search.ask}</span>
            <CornerDownLeft className="w-3 h-3" />
          </button>
        </div>
      </form>

      {/* Control Strip: Format Filters + Preset Chips + Quota */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Format Selectors */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]">
          {(['ALL', 'MANHWA', 'MANGA', 'MANHUA'] as const).map((tType) => (
            <button
              key={tType}
              type="button"
              onClick={() => onTypeChange(tType)}
              className={cn(
                'px-2.5 py-1 rounded-md font-mono-data text-[11px] font-medium transition-colors cursor-pointer',
                selectedType === tType
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-subtle)] font-bold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              {tType === 'ALL' ? t.common.all : tType}
            </button>
          ))}
        </div>

        {/* Preset Starter Prompts Chips */}
        <div className="hidden lg:flex items-center gap-1.5 overflow-x-auto max-w-xl">
          {t.starterPrompts.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => {
                onQueryChange(item.prompt);
                onSubmit(item.prompt);
              }}
              className="px-2.5 py-1 rounded-md bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[11px] transition-colors truncate max-w-[180px] cursor-pointer"
              title={item.prompt}
            >
              {item.title}
            </button>
          ))}
        </div>

        {/* Surprise Me / Gacha Button & Quota Counter */}
        <div className="flex items-center gap-2">
          {onSurpriseMe && (
            <button
              type="button"
              onClick={onSurpriseMe}
              disabled={isRollingGacha}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 dark:bg-gradient-to-r dark:from-amber-500/15 dark:via-[#ff334b]/15 dark:to-purple-500/15 dark:hover:from-amber-500/25 dark:hover:via-[#ff334b]/25 dark:hover:to-purple-500/25 border border-amber-500/50 text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-white font-mono-data text-[11px] font-bold transition-all cursor-pointer shadow-xs active:scale-95 group disabled:opacity-50"
              title={t.gacha.tooltip}
            >
              <Dices
                className={cn(
                  'w-3.5 h-3.5 text-amber-700 dark:text-amber-400 group-hover:rotate-180 transition-transform duration-500',
                  isRollingGacha && 'animate-spin text-[#ff334b]'
                )}
              />
              <span>{isRollingGacha ? t.gacha.rolling : t.gacha.surpriseMe}</span>
            </button>
          )}

          {/* Quota Counter */}
          <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] font-mono-data">
            <Zap className="w-3 h-3 text-[#ff334b]" />
            <span>
              {t.search.quota}: <strong className="text-[var(--text-primary)]">{rateLimitRemaining}</strong>/
              {maxRateLimit}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
