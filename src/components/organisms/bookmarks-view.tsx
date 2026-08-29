import { useState, useEffect, useCallback, useRef } from 'react';
import { Bookmark, BookOpen, Clock, CheckCircle, Download, Upload } from 'lucide-react';
import { ComicGridView } from '@/components/organisms/comic-grid-view';
import { ComicInspector } from '@/components/organisms/comic-inspector';
import { Button } from '@/components/ui/button';
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
      if (rows.length > 0 && !selectedComic && typeof window !== 'undefined' && window.innerWidth >= 1024) {
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

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-56px)] overflow-hidden max-w-[1600px] w-full mx-auto">
      <main className="flex-1 flex flex-col h-full overflow-y-auto px-4 sm:px-6 py-5 gap-4 pb-24 lg:pb-8">
        {/* Header Title & Status Filter Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[var(--border-subtle)] font-mono-data text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <Bookmark className="w-4 h-4 text-[#ff334b] fill-current" />
            <span className="text-[var(--text-primary)] font-semibold uppercase">
              {t.bookmarks.title} ({bookmarkedComics.length})
            </span>

            {/* The library lives in localStorage, so a file the user keeps is
                the only backup that exists. Native file input, no dependency. */}
            <button
              type="button"
              onClick={() => exportBookmarks(bookmarks)}
              disabled={bookmarkedIds.length === 0}
              className="flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-raised)] text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-muted)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-3 h-3" />
              {t.bookmarks.export}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-raised)] text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-muted)] transition-colors cursor-pointer"
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
            {/* w-full: wraps to its own line instead of squeezing the status
                pills in the row opposite. */}
            {importError && (
              <span className="w-full text-[10px] text-[#ff334b]">{importError}</span>
            )}
          </div>

          {/* Reading Status Filter Pills */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] overflow-x-auto text-[11px]">
            <button
              type="button"
              onClick={() => setActiveFilter('ALL')}
              className={cn(
                'px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap',
                activeFilter === 'ALL'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-bold shadow-xs border border-[var(--border-subtle)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              {t.bookmarks.all} ({countByStatus.ALL})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('READING')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap',
                activeFilter === 'READING'
                  ? 'bg-[#ff334b]/15 text-[#ff334b] font-bold border border-[#ff334b]/40 shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              <BookOpen className="w-3 h-3 text-[#ff334b]" />
              <span>{t.bookmarks.reading}</span>
              {countByStatus.READING > 0 && <span className="opacity-75">({countByStatus.READING})</span>}
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('PLAN_TO_READ')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap',
                activeFilter === 'PLAN_TO_READ'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/40 shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>{t.bookmarks.planToRead}</span>
              {countByStatus.PLAN_TO_READ > 0 && <span className="opacity-75">({countByStatus.PLAN_TO_READ})</span>}
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('COMPLETED')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap',
                activeFilter === 'COMPLETED'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-500/40 shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>{t.bookmarks.completed}</span>
              {countByStatus.COMPLETED > 0 && <span className="opacity-75">({countByStatus.COMPLETED})</span>}
            </button>
          </div>
        </div>

        {/* Content */}
        {filteredComics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 max-w-md mx-auto my-auto shadow-xs">
            <Bookmark className="w-8 h-8 text-[var(--text-muted)] mb-3" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1 font-mono-data">
              {t.bookmarks.emptyTitle}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mb-5 leading-relaxed">
              {t.bookmarks.emptyDesc}
            </p>
            <Button variant="crimson" size="sm" onClick={onNavigateToCatalog}>
              <BookOpen className="w-3.5 h-3.5" />
              <span>{t.bookmarks.exploreCatalog}</span>
            </Button>
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
