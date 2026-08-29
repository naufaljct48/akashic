import { useState } from 'react';
import { Bookmark, Compass, Menu, X, Flame, Zap, Calendar, ExternalLink, Newspaper } from 'lucide-react';
import { AkashicLogo } from '@/components/ui/akashic-logo';
import { LanguageDropdown } from '@/components/molecules/language-dropdown';
import { ThemeToggle } from '@/components/molecules/theme-toggle';
import { GlobalCommandSearch } from '@/components/molecules/global-command-search';
import { useI18n } from '@/core/i18n/context';
import type { Comic } from '@/core/types/comic';
import { isoWeek, TITLES_ON_FILE } from '@/core/constants/issue';
import { cn } from '@/lib/utils/cn';

export type WorkspaceTab = 'discovery' | 'catalog' | 'bookmarks';

/** Each section prints in its own ink, and keeps it across every surface. */
const SECTION_INK: Record<WorkspaceTab, string> = {
  discovery: 'var(--ink-magenta)',
  catalog: 'var(--ink-blue)',
  bookmarks: 'var(--ink-gold)',
};

interface WorkspaceHeaderProps {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  bookmarkCount: number;
  onSelectComic?: (comic: Comic) => void;
}

export function WorkspaceHeader({
  activeTab,
  onTabChange,
  bookmarkCount,
  onSelectComic,
}: WorkspaceHeaderProps) {
  const { t, locale } = useI18n();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const now = new Date();
  const issueNo = isoWeek(now);
  const issueDate = now
    .toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    .toUpperCase();

  const sections: { id: WorkspaceTab; label: string; hint: string; icon: typeof Compass }[] = [
    { id: 'discovery', label: t.nav.discovery, hint: t.nav.discoveryHint, icon: Newspaper },
    { id: 'catalog', label: t.nav.catalog, hint: t.nav.catalogHint, icon: Compass },
    { id: 'bookmarks', label: t.nav.bookmarks, hint: t.nav.savedLibrary, icon: Bookmark },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 w-full bg-[var(--paper)] border-b-2 border-[var(--ink)]">
        {/* The masthead band */}
        <div className="max-w-[1600px] mx-auto px-3.5 sm:px-6 h-[52px] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onTabChange('discovery')}
            className="flex items-center gap-2.5 cursor-pointer select-none shrink-0 group"
            aria-label={t.press.frontPage}
          >
            <AkashicLogo size={26} className="text-[var(--ink)]" />
            {/*
              The running head, on every section including the front page.
              Hiding it on discovery alone changed this block's width between
              tabs and shifted the whole nav on each switch — a moving navbar
              costs more than a wordmark that also appears, much larger, in the
              masthead below it.
            */}
            <span className="masthead text-[20px] sm:text-[24px] text-[var(--ink)] group-hover:text-[var(--spot-text)] transition-colors">
              Akashic Dex
            </span>
          </button>

          {/* Sections, as a newspaper's own wayfinding: names, not icons. */}
          <nav className="hidden md:flex items-stretch self-stretch gap-6" aria-label={t.nav.mainMenu}>
            {sections.map((section) => {
              const isActive = activeTab === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => onTabChange(section.id)}
                  style={{ ['--spot' as string]: SECTION_INK[section.id] }}
                  className={cn(
                    'stamp relative flex items-center gap-1.5 px-1 text-[11px] transition-colors cursor-pointer border-b-[3px]',
                    isActive
                      ? 'text-[var(--ink)] border-[var(--spot)]'
                      : 'text-[var(--ink-faint)] border-transparent hover:text-[var(--ink)]'
                  )}
                >
                  <span>{section.label}</span>
                  {section.id === 'bookmarks' && bookmarkCount > 0 && (
                    <span className="figures px-1 py-px bg-[var(--spot)] text-[var(--on-spot)] text-[9px] leading-none">
                      {bookmarkCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 shrink-0">
            <GlobalCommandSearch
              onSelectComic={(comic) => {
                if (onSelectComic) onSelectComic(comic);
              }}
            />
            <LanguageDropdown />
            <ThemeToggle />

            <a
              href="https://github.com/naufaljct48/akashic"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex p-1.5 border border-[var(--rule)] bg-[var(--paper-sheet)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--ink)] transition-colors items-center justify-center"
              title={t.press.source}
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-1.5 border border-[var(--rule)] bg-[var(--paper-sheet)] text-[var(--ink)] transition-colors cursor-pointer"
              aria-label={t.nav.mainMenu}
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* The issue strip: what edition you are holding. */}
        <div className="bg-[var(--ink)] text-[var(--paper)]">
          <div className="max-w-[1600px] mx-auto px-3.5 sm:px-6 h-[26px] flex items-center justify-between gap-4 overflow-hidden">
            <div className="stamp figures flex items-center gap-2 sm:gap-3 text-[9px] whitespace-nowrap">
              <span>{t.press.weeklyEdition}</span>
              <span aria-hidden className="opacity-40">/</span>
              <span>{t.press.issue} {issueNo}</span>
              <span aria-hidden className="opacity-40">/</span>
              <span>{issueDate}</span>
            </div>
            <div className="stamp figures flex items-center gap-2 text-[9px] whitespace-nowrap">
              <span>{t.press.titlesOnFile(TITLES_ON_FILE)}</span>
              <span className="hidden sm:inline opacity-40" aria-hidden>/</span>
              <span className="hidden sm:inline">{t.press.freeNoAccount}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer — the issue's contents page */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex justify-end">
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-[color-mix(in_oklab,var(--ink)_75%,transparent)] animate-in fade-in duration-200"
          />

          <aside className="relative z-10 w-[290px] sm:w-[330px] h-full bg-[var(--paper-sheet)] border-l-2 border-[var(--ink)] flex flex-col overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-4 h-[52px] border-b-2 border-[var(--ink)] shrink-0">
              <div className="flex items-center gap-2 select-none">
                <AkashicLogo size={22} className="text-[var(--ink)]" />
                <span className="masthead text-lg text-[var(--ink)]">{t.press.contents}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                aria-label={t.spotlight.close}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 py-4 border-b border-[var(--rule)]">
              <p className="stamp text-[9px] text-[var(--ink-faint)] mb-1.5">{t.about.title}</p>
              <p className="text-xs text-[var(--ink-soft)] leading-relaxed">{t.about.shortDesc}</p>
            </div>

            {/* Sections */}
            <nav className="flex flex-col">
              {sections.map((section) => {
                const isActive = activeTab === section.id;
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => {
                      onTabChange(section.id);
                      setIsMobileMenuOpen(false);
                    }}
                    style={{ ['--spot' as string]: SECTION_INK[section.id] }}
                    className={cn(
                      'flex items-center justify-between gap-3 px-4 py-3.5 border-b border-[var(--rule)] text-left transition-colors cursor-pointer',
                      isActive ? 'bg-[var(--spot-wash)]' : 'hover:bg-[var(--paper-deep)]'
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={cn('w-[3px] self-stretch h-6', isActive ? 'bg-[var(--spot)]' : 'bg-transparent')}
                        aria-hidden
                      />
                      <Icon
                        className={cn('w-4 h-4', isActive ? 'text-[var(--spot-text)]' : 'text-[var(--ink-faint)]')}
                      />
                      <span className="flex flex-col leading-tight">
                        <span className="stamp text-[11px] text-[var(--ink)]">{section.label}</span>
                        <span className="text-[10px] text-[var(--ink-faint)] normal-case tracking-normal mt-0.5">
                          {section.hint}
                        </span>
                      </span>
                    </span>
                    {section.id === 'bookmarks' && bookmarkCount > 0 && (
                      <span className="stamp figures px-1.5 py-0.5 bg-[var(--spot)] text-[var(--on-spot)] text-[9px]">
                        {bookmarkCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Feed shortcuts */}
            <div className="px-4 pt-4 pb-2">
              <p className="stamp text-[9px] text-[var(--ink-faint)] pb-2 mb-1 border-b border-[var(--rule)]">
                {t.nav.quickFeeds}
              </p>
              {[
                { icon: Flame, label: t.feeds.trending },
                { icon: Zap, label: t.feeds.recentUpdates },
                { icon: Calendar, label: t.feeds.newReleases },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    onTabChange('discovery');
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 py-2 text-left text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 text-[var(--ink-faint)]" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Colophon */}
            <div className="mt-auto px-4 py-4 border-t-2 border-[var(--ink)]">
              <a
                href="https://github.com/naufaljct48/akashic"
                target="_blank"
                rel="noreferrer"
                className="stamp flex items-center justify-between text-[10px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
              >
                <span>{t.press.source}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <p className="stamp figures text-[9px] text-[var(--ink-faint)] mt-3">
                Akashic Dex · {t.press.issue} {issueNo} · v1.0.0
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* Bottom section rail (mobile) */}
      <nav
        aria-label={t.nav.mainMenu}
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--paper)] border-t-2 border-[var(--ink)] flex items-stretch select-none"
      >
        {sections.map((section) => {
          const isActive = activeTab === section.id;
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onTabChange(section.id)}
              style={{ ['--spot' as string]: SECTION_INK[section.id] }}
              className={cn(
                'stamp relative flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[9px] transition-colors cursor-pointer border-t-[3px] -mt-[3px]',
                isActive
                  ? 'text-[var(--ink)] border-[var(--spot)]'
                  : 'text-[var(--ink-faint)] border-transparent'
              )}
            >
              <span className="relative">
                <Icon className={cn('w-4 h-4', isActive && 'text-[var(--spot-text)]')} />
                {section.id === 'bookmarks' && bookmarkCount > 0 && (
                  <span className="figures absolute -top-1.5 -right-2.5 px-1 bg-[var(--spot)] text-[var(--on-spot)] text-[9px] leading-[1.35]">
                    {bookmarkCount}
                  </span>
                )}
              </span>
              <span>{section.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
