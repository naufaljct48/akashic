import { useState, useEffect, useCallback, useRef } from 'react';
import { BookOpen, Download, Upload } from 'lucide-react';
import { ComicGridView } from '@/components/organisms/comic-grid-view';
import { ComicInspector } from '@/components/organisms/comic-inspector';
import { Folio } from '@/components/molecules/folio';
import { useI18n } from '@/core/i18n/context';
import { supabase } from '@/lib/supabase/client';
import { findComicByTitle, PAGE_SIZE } from '@/services/comic.service';
import {
  exportBookmarks,
  importBookmarks,
  type BookmarkMap,
  type ReadingStatus,
} from '@/core/types/bookmark';
import type { ComicSearchResult } from '@/core/types/comic';
import { useComicDeepLink } from '@/lib/hooks/use-comic-deep-link';
import { cn } from '@/lib/utils/cn';

interface BookmarksViewProps {
  onToggleBookmark: (comicId: string) => void;
  bookmarks: BookmarkMap;
  onUpdateBookmarkStatus?: (id: string, status: ReadingStatus, progress?: number) => void;
  onNavigateToCatalog: () => void;
  onReplaceBookmarks: (next: BookmarkMap) => void;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function BookmarksView({
  onToggleBookmark,
  bookmarks,
  onUpdateBookmarkStatus,
  onNavigateToCatalog,
  onReplaceBookmarks,
}: BookmarksViewProps) {
  const { t } = useI18n();
  const [bookmarkedComics, setBookmarkedComics] = useState<ComicSearchResult[]>([]);
  const [selectedComic, setSelectedComic] = useState<ComicSearchResult | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | ReadingStatus>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  // The whole library is already in memory; paging here is purely about not
  // mounting hundreds of cover images at once.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const bookmarkedIds = Object.keys(bookmarks);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // A bookmarks link can point at a title the recipient has not saved, so the
  // resolved comic is shown in the inspector without being injected into the
  // grid — this view is the user's own library, not a search result.
  const { pendingSlug: deepLinkSlug } = useComicDeepLink(selectedComic, setSelectedComic);

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      onReplaceBookmarks(await importBookmarks(file, bookmarks));
      setImportError(null);
    } catch {
      setImportError(t.bookmarks.importFailed);
    }
  };

  useEffect(() => {
    async function loadBookmarks() {
      if (bookmarkedIds.length === 0) {
        setBookmarkedComics([]);
        setSelectedComic(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      // Bookmark ids come in two shapes. Catalog picks are UUIDs; anything
      // saved from a live AniList feed (Trending / Recently Updated / New
      // Releases) is keyed `anilist-<n>`. Handing one of those to .in('id', …)
      // makes Postgres reject the ENTIRE query as an invalid uuid, so a single
      // Trending bookmark used to blank the whole library — silently, because
      // the error branch just left the list empty.
      const catalogIds = bookmarkedIds.filter((id) => UUID_RE.test(id));
      const liveSourceIds = bookmarkedIds
        .filter((id) => id.startsWith('anilist-'))
        .map((id) => Number(id.slice('anilist-'.length)))
        .filter((n) => Number.isFinite(n));

      const rows: ComicSearchResult[] = [];

      if (catalogIds.length > 0) {
        const { data } = await (supabase.from('comics') as any).select('*').in('id', catalogIds);
        rows.push(...((data as ComicSearchResult[]) || []));
      }

      // The same title usually IS in the catalog under a different id, so look
      // it up by AniList's own id and hand back the row wearing the bookmark's
      // key — otherwise the status pill and the un-bookmark button look for an
      // entry that isn't in the map.
      if (liveSourceIds.length > 0) {
        const { data } = await (supabase.from('comics') as any)
          .select('*')
          .in('source_id', liveSourceIds);
        rows.push(
          ...((data as ComicSearchResult[]) || []).map((c) => ({
            ...c,
            id: `anilist-${c.source_id}`,
          }))
        );
      }

      setBookmarkedComics(rows);
      if (rows.length > 0 && !selectedComic && !deepLinkSlug && typeof window !== 'undefined' && window.innerWidth >= 1024) {
        setSelectedComic(rows[0]);
      }
      setIsLoading(false);
    }

    loadBookmarks();
  }, [bookmarks]);

  const filteredComics = bookmarkedComics.filter((comic) => {
    if (activeFilter === 'ALL') return true;
    const item = bookmarks[comic.id];
    return item?.status === activeFilter;
  });

  const visibleComics = filteredComics.slice(0, visibleCount);
  const hasMore = filteredComics.length > visibleCount;

  // Switching status tabs restarts the reveal from the top.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeFilter]);

  const loadMore = useCallback(() => {
    setVisibleCount((n) => n + PAGE_SIZE);
  }, []);

  // Recommendations are openable here too, but they are NOT injected into the
  // grid: this view is the user's saved library, and a title they never
  // bookmarked has no business appearing in it.
  const handleSelectRelatedTitle = async (title: string) => {
    const lower = title.toLowerCase();
    const saved = bookmarkedComics.find(
      (c) => c.title_english?.toLowerCase() === lower || c.title_romaji?.toLowerCase() === lower
    );
    if (saved) {
      setSelectedComic(saved);
      return;
    }

    const found = await findComicByTitle(title);
    if (found) setSelectedComic(found);
  };

  const countByStatus = {
    ALL: bookmarkedComics.length,
    READING: bookmarkedComics.filter((c) => bookmarks[c.id]?.status === 'READING').length,
    PLAN_TO_READ: bookmarkedComics.filter((c) => bookmarks[c.id]?.status === 'PLAN_TO_READ').length,
    COMPLETED: bookmarkedComics.filter((c) => bookmarks[c.id]?.status === 'COMPLETED').length,
  };

  const statusTabs: { id: 'ALL' | ReadingStatus; label: string; count: number }[] = [
    { id: 'ALL', label: t.bookmarks.all, count: countByStatus.ALL },
    { id: 'READING', label: t.bookmarks.reading, count: countByStatus.READING },
    { id: 'PLAN_TO_READ', label: t.bookmarks.planToRead, count: countByStatus.PLAN_TO_READ },
    { id: 'COMPLETED', label: t.bookmarks.completed, count: countByStatus.COMPLETED },
  ];

  return (
    <div
      className="flex flex-col lg:flex-row h-[var(--view-h)] overflow-hidden max-w-[1600px] w-full mx-auto"
      style={{ ['--spot' as string]: 'var(--ink-gold)' }}
    >
      <main className="flex-1 flex flex-col h-full overflow-y-auto px-3.5 sm:px-6 py-5 gap-4 pb-28 lg:pb-10">
        {/* The reader's own file */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 pb-2.5 border-b-2 border-[var(--ink)]">
          <h2 className="masthead text-[clamp(1.1rem,2.4vw,1.5rem)] text-[var(--ink)]">
            {t.bookmarks.title}
          </h2>

          <div className="flex items-center gap-2">
            {/* The library lives in localStorage, so a file the user keeps is
                the only backup that exists. Native file input, no dependency. */}
            <button
              type="button"
              onClick={() => exportBookmarks(bookmarks)}
              disabled={bookmarkedIds.length === 0}
              className="stamp flex items-center gap-1.5 py-1 text-[10px] border-b-2 border-[var(--rule)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--ink)] transition-colors cursor-pointer disabled:opacity-35 disabled:pointer-events-none"
            >
              <Download className="w-3 h-3" />
              {t.bookmarks.export}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="stamp flex items-center gap-1.5 py-1 text-[10px] border-b-2 border-[var(--rule)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--ink)] transition-colors cursor-pointer"
            >
              <Upload className="w-3 h-3" />
              {t.bookmarks.import}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                void handleImportFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {importError && (
          <p className="stamp text-[9px] text-[var(--ink-vermilion)]">{importError}</p>
        )}

        {/* Status dividers */}
        <nav className="flex items-stretch gap-4 sm:gap-6 overflow-x-auto border-b border-[var(--rule)]">
          {statusTabs.map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={cn(
                  'stamp figures flex items-center gap-1.5 pb-2 -mb-px text-[10px] whitespace-nowrap border-b-[3px] transition-colors cursor-pointer',
                  isActive
                    ? 'text-[var(--ink)] border-[var(--spot)]'
                    : 'text-[var(--ink-faint)] border-transparent hover:text-[var(--ink)]'
                )}
              >
                <span>{tab.label}</span>
                <span className={cn('text-[9px]', isActive ? 'text-[var(--spot-text)]' : 'opacity-70')}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </nav>

        {filteredComics.length === 0 ? (
          <div className="py-16 px-6 my-auto text-center border-y-2 border-[var(--ink)] max-w-lg mx-auto">
            <p className="masthead text-2xl sm:text-3xl text-[var(--ink)] mb-2.5">
              {t.bookmarks.emptyTitle}
            </p>
            <p className="text-sm text-[var(--ink-soft)] leading-relaxed mb-6 max-w-[46ch] mx-auto">
              {t.bookmarks.emptyDesc}
            </p>
            <button
              type="button"
              onClick={onNavigateToCatalog}
              className="stamp inline-flex items-center gap-2 py-1.5 text-[11px] border-b-2 border-[var(--ink)] text-[var(--ink)] hover:border-[var(--spot)] hover:text-[var(--spot-text)] transition-colors cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{t.bookmarks.exploreCatalog}</span>
            </button>
          </div>
        ) : (
          <div className="flex-1 pb-8">
            <ComicGridView
              comics={visibleComics}
              selectedId={selectedComic?.id || null}
              onSelect={(comic) => setSelectedComic(comic)}
              onToggleBookmark={onToggleBookmark}
              bookmarkedIds={new Set(bookmarkedIds)}
              isLoading={isLoading}
              hasMore={hasMore}
              onLoadMore={loadMore}
            />
          </div>
        )}

        <Folio
          section={t.nav.savedLibrary}
          tally={`${filteredComics.length}/${bookmarkedComics.length}`}
        />
      </main>

      {/* Inspector for selected bookmark */}
      {selectedComic && (
        <ComicInspector
          comic={selectedComic}
          onClose={() => setSelectedComic(null)}
          onToggleBookmark={onToggleBookmark}
          isBookmarked={Boolean(bookmarks[selectedComic.id])}
          bookmarkItem={bookmarks[selectedComic.id] || null}
          onUpdateBookmarkStatus={onUpdateBookmarkStatus}
          onSelectRelatedTitle={handleSelectRelatedTitle}
        />
      )}
    </div>
  );
}
