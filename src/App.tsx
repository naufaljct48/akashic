import { useState, useEffect, lazy, Suspense } from 'react';
import { I18nProvider } from '@/core/i18n/context';
import { ThemeProvider } from '@/core/theme/theme-context';
import { WorkspaceHeader, type WorkspaceTab } from '@/components/templates/workspace-header';
import { DiscoveryWorkspace } from '@/components/organisms/discovery-workspace';
import {
  loadStoredBookmarks,
  saveStoredBookmarks,
  type BookmarkMap,
  type ReadingStatus,
} from '@/core/types/bookmark';
import type { Comic, ComicSearchResult } from '@/core/types/comic';

// Code Splitting with React.lazy to reduce initial JS bundle size to < 120 kB
const CatalogBrowser = lazy(() =>
  import('@/components/organisms/catalog-browser').then((m) => ({
    default: m.CatalogBrowser,
  }))
);
const BookmarksView = lazy(() =>
  import('@/components/organisms/bookmarks-view').then((m) => ({
    default: m.BookmarksView,
  }))
);

function TabLoadingFallback() {
  return (
    <div className="flex-1 flex items-center justify-center p-12">
      <div className="flex flex-col items-center gap-3 font-mono-data text-xs text-[var(--text-muted)] animate-pulse">
        <div className="w-8 h-8 rounded-full border-2 border-[#ff334b] border-t-transparent animate-spin" />
        <span>Loading workspace modules...</span>
      </div>
    </div>
  );
}

function AppContent() {
  // Which tab is open is part of the address, or a shared link always lands on
  // Discovery no matter what it pointed at. Read once; `discovery` is the
  // default so it stays out of the URL.
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(() => {
    if (typeof window === 'undefined') return 'discovery';
    const tab = new URLSearchParams(window.location.search).get('tab');
    return tab === 'catalog' || tab === 'bookmarks' ? tab : 'discovery';
  });

  // Only the tab is written here. Clearing ?c= on a switch cannot work from
  // this level: React mounts the incoming view — which reads ?c= during render
  // — before the parent effect runs, so the param is always read before it
  // could be cleared, and the new view's own writer puts it straight back.
  // Rather than fight that ordering, the open title deliberately follows you
  // across tabs.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeTab === 'discovery') url.searchParams.delete('tab');
    else url.searchParams.set('tab', activeTab);
    window.history.replaceState(null, '', url);
  }, [activeTab]);
  const [spotlightSelectedComic, setSpotlightSelectedComic] = useState<ComicSearchResult | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkMap>(() => loadStoredBookmarks());

  const bookmarkedIds = new Set(Object.keys(bookmarks));

  const toggleBookmark = (comicId: string) => {
    setBookmarks((prev) => {
      const next: BookmarkMap = { ...prev };
      if (next[comicId]) {
        delete next[comicId];
      } else {
        next[comicId] = {
          comicId,
          status: 'PLAN_TO_READ',
          updatedAt: new Date().toISOString(),
        };
      }
      saveStoredBookmarks(next);
      return next;
    });
  };

  const updateBookmarkStatus = (
    comicId: string,
    status: ReadingStatus,
    progressChapter?: number
  ) => {
    setBookmarks((prev) => {
      const next: BookmarkMap = { ...prev };
      next[comicId] = {
        comicId,
        status,
        progressChapter: progressChapter !== undefined ? progressChapter : next[comicId]?.progressChapter || 0,
        updatedAt: new Date().toISOString(),
      };
      saveStoredBookmarks(next);
      return next;
    });
  };

  const replaceBookmarks = (next: BookmarkMap) => {
    saveStoredBookmarks(next);
    setBookmarks(next);
  };

  const handleSelectFromSpotlight = (comic: Comic) => {
    setSpotlightSelectedComic(comic as ComicSearchResult);
    setActiveTab('discovery');
  };

  // Main Application Workspace (Discovery, Catalog, Bookmarks)
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col font-sans selection:bg-[#ff334b] selection:text-white transition-colors duration-150">
      {/* Top Technical Workspace Header with Elastic Quick Search */}
      <WorkspaceHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        bookmarkCount={bookmarkedIds.size}
        onSelectComic={handleSelectFromSpotlight}
      />

      {/* Workspace Body */}
      {activeTab === 'discovery' && (
        <DiscoveryWorkspace
          onToggleBookmark={toggleBookmark}
          bookmarkedIds={bookmarkedIds}
          bookmarks={bookmarks}
          onUpdateBookmarkStatus={updateBookmarkStatus}
          externalSelectedComic={spotlightSelectedComic}
        />
      )}

      {activeTab === 'catalog' && (
        <Suspense fallback={<TabLoadingFallback />}>
          <CatalogBrowser
            onToggleBookmark={toggleBookmark}
            bookmarkedIds={bookmarkedIds}
            bookmarks={bookmarks}
            onUpdateBookmarkStatus={updateBookmarkStatus}
          />
        </Suspense>
      )}

      {activeTab === 'bookmarks' && (
        <Suspense fallback={<TabLoadingFallback />}>
          <BookmarksView
            onToggleBookmark={toggleBookmark}
            bookmarks={bookmarks}
            onUpdateBookmarkStatus={updateBookmarkStatus}
            onNavigateToCatalog={() => setActiveTab('catalog')}
            onReplaceBookmarks={replaceBookmarks}
          />
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AppContent />
      </I18nProvider>
    </ThemeProvider>
  );
}
