import { useState } from 'react';
import { Sparkles, Database, BookOpen, ChevronDown } from 'lucide-react';
import { AkashicLogo } from '@/components/ui/akashic-logo';
import { useI18n } from '@/core/i18n/context';
import { cn } from '@/lib/utils/cn';

const BANNER_STORAGE_KEY = 'akashic_about_banner_dismissed';

export function AboutAkashicBanner() {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(BANNER_STORAGE_KEY) !== 'true';
    } catch {
      return true;
    }
  });

  const toggleExpand = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(BANNER_STORAGE_KEY, String(!next));
      } catch (err) {
        console.error(err);
      }
      return next;
    });
  };

  const pillars = [
    {
      icon: Sparkles,
      accent: 'text-[#ff334b]',
      title: t.about.p1Title,
      desc: t.about.p1Desc,
    },
    {
      icon: Database,
      accent: 'text-amber-600 dark:text-amber-400',
      title: t.about.p2Title,
      desc: t.about.p2Desc,
    },
    {
      icon: BookOpen,
      accent: 'text-emerald-600 dark:text-emerald-400',
      title: t.about.p3Title,
      desc: t.about.p3Desc,
    },
  ];

  return (
    <div
      className={cn(
        'relative shrink-0 rounded-2xl border border-[var(--border-subtle)] overflow-hidden',
        'transition-[background-color,padding,box-shadow] duration-300 ease-out',
        isExpanded
          ? 'bg-gradient-to-br from-[var(--bg-surface-raised)] via-[var(--bg-surface)] to-[var(--bg-surface-raised)] p-3.5 sm:p-5 shadow-sm'
          : 'bg-[var(--bg-surface)] px-3 py-2 shadow-xs'
      )}
    >
      {/* Background Subtle Cyberpunk Ambient Glow */}
      <div
        className={cn(
          'absolute top-0 right-0 w-48 sm:w-64 h-28 sm:h-32 bg-[#ff334b]/5 blur-3xl pointer-events-none -z-0',
          'transition-opacity duration-300',
          isExpanded ? 'opacity-100' : 'opacity-0'
        )}
      />

      {/* Header — stays mounted in both states so nothing jumps on toggle. */}
      <button
        type="button"
        onClick={toggleExpand}
        aria-expanded={isExpanded}
        className="relative z-10 w-full flex items-center justify-between gap-2.5 text-left cursor-pointer group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              'shrink-0 transition-transform duration-300 ease-out',
              isExpanded ? 'scale-100' : 'scale-[0.85]'
            )}
          >
            <AkashicLogo size={24} withGlow={isExpanded} />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] font-jakarta tracking-tight truncate">
              {t.about.title}
            </h2>
            <span className="text-[9px] sm:text-[10px] font-mono-data px-1.5 py-0.2 rounded bg-[#ff334b]/15 text-[#ff334b] border border-[#ff334b]/30 font-bold uppercase shrink-0">
              {t.about.badge}
            </span>
          </div>
        </div>

        <span
          className="p-1 rounded-lg text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors shrink-0"
          title={isExpanded ? t.about.hideDetails : t.about.showDetails}
        >
          <ChevronDown
            className={cn(
              'w-4 h-4 transition-transform duration-300 ease-out',
              isExpanded && 'rotate-180'
            )}
          />
        </span>
      </button>

      {/*
        Smooth collapse without measuring anything in JS: a grid row animated
        between 0fr and 1fr resolves to the child's natural height, so the panel
        eases open and shut instead of the old two-DOM-tree swap that popped.
      */}
      <div
        className={cn(
          'relative z-10 grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none',
          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden min-h-0">
          <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] font-jakarta mt-2 leading-relaxed max-w-2xl">
            {t.about.shortDesc}
          </p>

          {/* 3 Value Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3 mt-3 sm:mt-4 pt-3 border-t border-[var(--border-subtle)] font-mono-data text-xs">
            {pillars.map((pillar) => (
              <div
                key={pillar.title}
                className="p-2.5 sm:p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-1"
              >
                <div className={cn('flex items-center gap-1.5 font-bold text-[11px]', pillar.accent)}>
                  <pillar.icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="md:truncate">{pillar.title}</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] font-jakarta leading-relaxed">
                  {pillar.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Footer / Got it button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-3 pt-2.5 border-t border-[var(--border-subtle)] font-mono-data text-[11px]">
            <span className="text-[11px] text-[var(--text-muted)] sm:truncate">
              {t.about.searchTip}
            </span>
            <button
              type="button"
              onClick={toggleExpand}
              className="self-end sm:self-auto text-xs px-3 py-1 rounded-lg bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold transition-colors cursor-pointer shrink-0"
            >
              {t.about.gotIt}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
