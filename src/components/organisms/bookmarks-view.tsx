import { useState, useEffect, useCallback } from 'react';
import { Bookmark, BookOpen, Clock, CheckCircle } from 'lucide-react';
import { ComicGridView } from '@/components/organisms/comic-grid-view';
import { ComicInspector } from '@/components/organisms/comic-inspector';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/core/i18n/context';
import { supabase } from '@/lib/supabase/client';
import { findComicByTitle, PAGE_SIZE } from '@/services/comic.service';
import type { BookmarkMap, ReadingStatus } from '@/core/types/bookmark';
import type { ComicSearchResult } from '@/core/types/comic';
import { cn } from '@/lib/utils/cn';

interface BookmarksViewProps {
  onToggleBookmark: (comicId: string) => void;
  bookmarks: BookmarkMap;
  onUpdateBookmarkStatus?: (id: string, status: ReadingStatus, progress?: number) => void;
  onNavigateToCatalog: () => void;
}

export function BookmarksView({
  onToggleBookmark,
  bookmarks,
  onUpdateBookmarkStatus,
  onNavigateToCatalog,
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

  useEffect(() => {
    async function loadBookmarks() {
      if (bookmarkedIds.length === 0) {
        setBookmarkedComics([]);
        setSelectedComic(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const { data, error } = await supabase
        .from('comics')
        .select('*')
        .in('id', bookmarkedIds);

      if (!error && data) {
        const casted = data as ComicSearchResult[];
        setBookmarkedComics(casted);
        if (casted.length > 0 && !selectedComic && typeof window !== 'undefined' && window.innerWidth >= 1024) {
          setSelectedComic(casted[0]);
        }
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
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-[#ff334b] fill-current" />
            <span className="text-[var(--text-primary)] font-semibold uppercase">
              {t.bookmarks.title} ({bookmarkedComics.length})
            </span>
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
