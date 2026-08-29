import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useI18n } from '@/core/i18n/context';
import { cn } from '@/lib/utils/cn';

const GUIDE_STORAGE_KEY = 'akashic_about_banner_dismissed';

/**
 * The front page's masthead.
 *
 * A weekly carries its name at issue scale on page one and a running head on
 * every page after it — which is why the sticky bar above drops the wordmark
 * here and keeps only the mark. The wordmark is overprinted: one ghost of
 * itself a hair off in the spot, the way a cheap press lands its plates.
 *
 * The standfirst runs under it as plain text. It carried a drop cap until the
 * copy started with "An": a two-letter word leaves the initial with a lone
 * letter hanging beside it, which reads as a typo rather than as a device.
 *
 * The three explainer columns fold away by default: on a front page the reader
 * came for the plates, not for a guide, and an expanded guide pushes both the
 * desk and the grid off the first viewport.
 */
export function FrontPageMasthead() {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(GUIDE_STORAGE_KEY) === 'false';
    } catch {
      return false;
    }
  });

  const toggleExpand = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(GUIDE_STORAGE_KEY, String(next));
      } catch (err) {
        console.error(err);
      }
      return next;
    });
  };

  const columns = [
    { title: t.about.p1Title, desc: t.about.p1Desc },
    { title: t.about.p2Title, desc: t.about.p2Desc },
    { title: t.about.p3Title, desc: t.about.p3Desc },
  ];

  return (
    <header className="shrink-0">
      <h1
        className="masthead overprint text-[clamp(2.6rem,10vw,5.5rem)] text-[var(--ink)] break-words"
        data-ink="Akashic Dex"
      >
        Akashic Dex
      </h1>

      <div className="border-t-[3px] border-[var(--ink)] mt-1.5" />

      <p className="text-sm sm:text-[15px] text-[var(--ink-soft)] leading-relaxed max-w-[64ch] mt-3">
        {t.about.shortDesc}
      </p>

      <button
        type="button"
        onClick={toggleExpand}
        aria-expanded={isExpanded}
        className="stamp flex items-center gap-1.5 mt-2.5 text-[9px] text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors cursor-pointer"
      >
        <span>{isExpanded ? t.about.hideDetails : t.about.showDetails}</span>
        <ChevronDown
          className={cn('w-3.5 h-3.5 transition-transform duration-300', isExpanded && 'rotate-180')}
        />
      </button>

      {/*
        Smooth collapse without measuring anything in JS: a grid row animated
        between 0fr and 1fr resolves to the child's natural height.
      */}
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none',
          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-3 mt-3 border-t border-[var(--rule)]">
            {columns.map((column) => (
              <div
                key={column.title}
                className="py-3 md:pr-5 border-b md:border-b-0 md:border-r border-[var(--rule)] last:border-0 md:pl-5 md:first:pl-0"
              >
                <h2 className="stamp text-[10px] text-[var(--spot-text)] mb-1.5">{column.title}</h2>
                <p className="text-xs text-[var(--ink-soft)] leading-relaxed">{column.desc}</p>
              </div>
            ))}
          </div>
          <p className="stamp text-[9px] text-[var(--ink-faint)] mt-2.5">{t.about.searchTip}</p>
        </div>
      </div>
    </header>
  );
}
