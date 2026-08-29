import React, { useRef, useEffect } from 'react';
import { CornerDownLeft, Dices, X } from 'lucide-react';
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
  /** Required: a default here silently disagreed with MAX_DAILY_PROMPTS and
   *  rendered "Quota: 30/10". The counter has exactly one source of truth. */
  maxRateLimit: number;
  onSurpriseMe?: () => void;
  isRollingGacha?: boolean;
}

/**
 * The editorial desk.
 *
 * One field, ruled like a submission form, with a solid spot bar across its
 * head — that bar is what marks this as the input you can talk to, a job the
 * old build gave to a rotating spectrum glow. While the query is out, the desk
 * shows its three stations working instead of a spinner, because the reader is
 * waiting on a process, not on an indeterminate wait.
 */
export function CommandSearchBar({
  query,
  onQueryChange,
  onSubmit,
  selectedType,
  onTypeChange,
  isLoading,
  rateLimitRemaining,
  maxRateLimit,
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

  const quotaSpent = maxRateLimit - rateLimitRemaining;

  return (
    <section className="w-full flex flex-col">
      {/* The desk */}
      <form onSubmit={handleFormSubmit} className="relative">
        {/* The spot rule: this is the field that answers in sentences. */}
        <div className="h-[5px] bg-[var(--spot)]" aria-hidden />

        <div className="field-ruled flex items-center gap-2 sm:gap-3 py-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t.search.placeholder}
            aria-label={t.search.ask}
            className="w-full bg-transparent text-base sm:text-lg text-[var(--ink)] placeholder-[var(--ink-faint)] focus:outline-none"
          />

          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              className="p-1 text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors cursor-pointer shrink-0"
              aria-label={t.search.resetQuery}
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            className="stamp flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-[var(--ink)] text-[var(--paper)] text-[10px] transition-opacity cursor-pointer disabled:opacity-25 disabled:pointer-events-none shrink-0 active:translate-y-px"
          >
            <span className="hidden sm:inline">{t.search.ask}</span>
            <CornerDownLeft className="w-3 h-3" />
          </button>
        </div>

        {/* The press, running. */}
        {isLoading && (
          <div
            className="stamp flex items-center gap-3 py-2 text-[9px] text-[var(--spot-text)]"
            role="status"
          >
            <span className="press-stage">{t.press.retrieving}</span>
            <span className="press-stage">{t.press.ranking}</span>
            <span className="press-stage">{t.press.printing}</span>
            <span className="ml-auto normal-case tracking-normal text-[10px] text-[var(--ink-faint)]">
              {t.search.searching}
            </span>
          </div>
        )}
      </form>

      {/* The control strip, set as a printed footer under the desk */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-2.5">
        <div className="flex items-center gap-4">
          {/* Format */}
          <div className="flex items-stretch">
            {(['ALL', 'MANHWA', 'MANGA', 'MANHUA'] as const).map((tType) => (
              <button
                key={tType}
                type="button"
                onClick={() => onTypeChange(tType)}
                className={cn(
                  'stamp px-2 sm:px-2.5 py-1 text-[9px] border-b-2 transition-colors cursor-pointer',
                  selectedType === tType
                    ? 'text-[var(--ink)] border-[var(--ink)]'
                    : 'text-[var(--ink-faint)] border-transparent hover:text-[var(--ink)]'
                )}
              >
                {tType === 'ALL' ? t.common.all : tType}
              </button>
            ))}
          </div>

          {onSurpriseMe && (
            <button
              type="button"
              onClick={onSurpriseMe}
              disabled={isRollingGacha}
              className="stamp flex items-center gap-1.5 py-1 text-[9px] whitespace-nowrap border-b-2 border-[var(--rule)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--ink)] transition-colors cursor-pointer disabled:opacity-40"
              title={t.gacha.tooltip}
            >
              <Dices className={cn('w-3.5 h-3.5', isRollingGacha && 'animate-spin')} />
              <span>{isRollingGacha ? t.gacha.rolling : t.gacha.surpriseMe}</span>
            </button>
          )}
        </div>

        {/* Quota, printed as a ration rather than a metric tile. */}
        <div className="stamp figures flex items-center gap-2 text-[9px] text-[var(--ink-faint)]">
          <span className="flex items-center gap-[3px]" aria-hidden>
            {Array.from({ length: maxRateLimit }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  'w-[3px] h-3',
                  i < quotaSpent ? 'bg-[var(--rule)]' : 'bg-[var(--spot)]'
                )}
              />
            ))}
          </span>
          <span>
            {rateLimitRemaining}/{maxRateLimit} {t.search.quota}
          </span>
        </div>
      </div>

      {/* Starter prompts: the desk's standing questions */}
      <div className="scroll-fade flex items-center gap-3 mt-2.5 pt-2.5 border-t border-[var(--rule)] overflow-x-auto pr-8">
        <span className="stamp text-[9px] text-[var(--ink-faint)] shrink-0">{t.press.tryThese}</span>
        {t.starterPrompts.map((item) => (
          <button
            key={item.title}
            type="button"
            onClick={() => {
              onQueryChange(item.prompt);
              onSubmit(item.prompt);
            }}
            className="text-[12px] py-0.5 border-b border-[var(--rule)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--ink)] transition-colors truncate max-w-[210px] cursor-pointer shrink-0"
            title={item.prompt}
          >
            {item.title}
          </button>
        ))}
      </div>
    </section>
  );
}
