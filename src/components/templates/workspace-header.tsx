import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Bookmark, Compass, Menu, X, Flame, Zap, Calendar, ExternalLink } from 'lucide-react';
import { AkashicLogo } from '@/components/ui/akashic-logo';
import { LanguageDropdown } from '@/components/molecules/language-dropdown';
import { ThemeToggle } from '@/components/molecules/theme-toggle';
import { GlobalCommandSearch } from '@/components/molecules/global-command-search';
import { useI18n } from '@/core/i18n/context';
import type { Comic } from '@/core/types/comic';
import { cn } from '@/lib/utils/cn';

export type WorkspaceTab = 'discovery' | 'catalog' | 'bookmarks';

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
  const { t } = useI18n();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Top Main Navbar (Desktop + Mobile Header) */}
      <header className="sticky top-0 z-30 w-full border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 backdrop-blur-md transition-colors duration-150">
        <div className="max-w-[1600px] mx-auto px-3.5 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: Akashic Dex Brand Logo */}
          <div
            onClick={() => onTabChange('discovery')}
            className="flex items-center gap-2 sm:gap-2.5 cursor-pointer select-none group shrink-0"
          >
            <AkashicLogo size={26} withGlow className="group-hover:scale-105 transition-transform" />
            <div className="flex items-center gap-1 font-mono-data text-xs sm:text-sm font-bold tracking-tight">
              <span className="text-[var(--text-primary)]">AKASHIC</span>
              <span className="text-[var(--text-muted)]">//</span>
              <span className="text-[#ff334b]">DEX</span>
            </div>
          </div>

          {/* Desktop Center: Navigation Tabs (Hidden on Mobile) */}
          <nav className="hidden md:flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] text-xs font-mono-data shrink-0">
            <button
              type="button"
              onClick={() => onTabChange('discovery')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors cursor-pointer',
                activeTab === 'discovery'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium shadow-xs border border-[var(--border-subtle)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#ff334b]" />
              <span>{t.nav.discovery}</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('catalog')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors cursor-pointer',
                activeTab === 'catalog'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium shadow-xs border border-[var(--border-subtle)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{t.nav.catalog}</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('bookmarks')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors cursor-pointer',
                activeTab === 'bookmarks'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium shadow-xs border border-[var(--border-subtle)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>{t.nav.bookmarks}</span>
              {bookmarkCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-[var(--bg-surface-hover)] text-amber-500 text-[10px] font-bold border border-[var(--border-subtle)]">
                  {bookmarkCount}
                </span>
              )}
            </button>
          </nav>

          {/* Right: Elastic Spotlight Search, Language Dropdown, Theme Toggle & GitHub */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Elastic Global Spotlight Search */}
            <GlobalCommandSearch
              onSelectComic={(comic) => {
                if (onSelectComic) {
                  onSelectComic(comic);
                }
              }}
            />

            {/* Language Dropdown */}
            <LanguageDropdown />

            {/* Dark/Light Mode Theme Toggle */}
            <ThemeToggle />

            {/* GitHub Repository (Hidden on mobile) */}
            <a
              href="https://github.com/naufaljct48/akashic"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] transition-colors items-center justify-center shrink-0"
              title="GitHub Repository"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>

            {/* Mobile Hamburger Menu Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
              aria-label="Buka Menu"
              title="Menu Navigasi"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Slide-over Mobile Navigation Drawer */}
      {isMobileMenuOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 md:hidden flex justify-end">
            {/* Backdrop Overlay */}
            <div
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
            />

            {/* Drawer Content */}
            <aside className="relative z-10 w-[280px] sm:w-[320px] h-full bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] flex flex-col p-5 gap-5 overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-200">
              {/* Drawer Top */}
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2 select-none">
                  <AkashicLogo size={24} withGlow />
                  <span className="font-mono-data text-xs font-bold text-[var(--text-primary)]">
                    AKASHIC <span className="text-[#ff334b]">// MENU</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* What is Akashic Dex Mobile Card */}
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#ff334b]/10 via-[var(--bg-surface-raised)] to-[var(--bg-surface)] border border-[#ff334b]/25 flex flex-col gap-1.5 font-mono-data text-xs">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                  <Sparkles className="w-3.5 h-3.5 text-[#ff334b]" />
                  <span>{t.about.title}</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] font-jakarta leading-relaxed">
                  {t.about.shortDesc}
                </p>
              </div>

              {/* Navigation Items */}
              <div className="flex flex-col gap-1.5 font-mono-data text-xs">
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold px-2 mb-1">
                  {t.nav.mainMenu}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    onTabChange('discovery');
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer',
                    activeTab === 'discovery'
                      ? 'bg-[#ff334b]/15 text-[#ff334b] font-bold border border-[#ff334b]/40 shadow-xs'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-[#ff334b]" />
                    <span>{t.nav.discovery}</span>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] font-normal">Explore AI</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onTabChange('catalog');
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer',
                    activeTab === 'catalog'
                      ? 'bg-[var(--bg-surface-raised)] text-[var(--text-primary)] font-bold border border-[var(--border-muted)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Compass className="w-4 h-4 text-[var(--text-primary)]" />
                    <span>{t.nav.catalog}</span>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] font-normal">300+ Tropes</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onTabChange('bookmarks');
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer',
                    activeTab === 'bookmarks'
                      ? 'bg-amber-500/15 text-amber-400 font-bold border border-amber-500/40 shadow-xs'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Bookmark className="w-4 h-4 text-amber-500 fill-current" />
                    <span>{t.nav.bookmarks}</span>
                  </div>
                  {bookmarkCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                      {bookmarkCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Feed Shortcuts */}
              <div className="flex flex-col gap-1.5 font-mono-data text-xs pt-3 border-t border-[var(--border-subtle)]">
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold px-2 mb-1">
                  {t.nav.quickFeeds}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    onTabChange('discovery');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)] transition-colors cursor-pointer text-left"
                >
                  <Flame className="w-4 h-4 text-orange-500 shrink-0" />
                  <span>{t.feeds.trending}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onTabChange('discovery');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)] transition-colors cursor-pointer text-left"
                >
                  <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t.feeds.recentUpdates}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onTabChange('discovery');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)] transition-colors cursor-pointer text-left"
                >
                  <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{t.feeds.newReleases}</span>
                </button>
              </div>

              {/* Drawer Footer Links */}
              <div className="mt-auto pt-4 border-t border-[var(--border-subtle)] flex flex-col gap-3 font-mono-data text-xs">
                <a
                  href="https://github.com/naufaljct48/akashic"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                    <span>GitHub Repo</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </a>

                <div className="text-[10px] text-[var(--text-muted)] text-center">
                  Akashic Dex v1.0.0 • Mobile UI
                </div>
              </div>
            </aside>
          </div>,
          document.body
        )}

      {/* Ergonomic Mobile Bottom Navigation Bar (Fixed for Mobile Screens < md) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--bg-surface)]/95 backdrop-blur-xl border-t border-[var(--border-subtle)] px-2 py-1.5 flex items-center justify-around shadow-lg select-none transition-colors"
      >
        <button
          type="button"
          onClick={() => onTabChange('discovery')}
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-1 px-4 rounded-xl text-[10px] font-mono-data transition-all cursor-pointer flex-1',
            activeTab === 'discovery'
              ? 'text-[#ff334b] font-bold bg-[#ff334b]/10'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          )}
        >
          <Sparkles className={cn('w-4 h-4 transition-transform', activeTab === 'discovery' && 'scale-110 text-[#ff334b]')} />
          <span>{t.nav.discovery}</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('catalog')}
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-1 px-4 rounded-xl text-[10px] font-mono-data transition-all cursor-pointer flex-1',
            activeTab === 'catalog'
              ? 'text-[var(--text-primary)] font-bold bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          )}
        >
          <Compass className={cn('w-4 h-4 transition-transform', activeTab === 'catalog' && 'scale-110 text-[var(--text-primary)]')} />
          <span>{t.nav.catalog}</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('bookmarks')}
          className={cn(
            'relative flex flex-col items-center justify-center gap-1 py-1 px-4 rounded-xl text-[10px] font-mono-data transition-all cursor-pointer flex-1',
            activeTab === 'bookmarks'
              ? 'text-amber-500 font-bold bg-amber-500/10'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          )}
        >
          <div className="relative">
            <Bookmark className={cn('w-4 h-4 transition-transform', activeTab === 'bookmarks' && 'scale-110 fill-current text-amber-500')} />
            {bookmarkCount > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1 py-0.2 rounded-full bg-amber-500 text-black text-[9px] font-extrabold leading-none">
                {bookmarkCount}
              </span>
            )}
          </div>
          <span>{t.nav.bookmarks}</span>
        </button>
      </nav>
    </>
  );
}
