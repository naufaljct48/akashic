import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Filter, ChevronDown } from 'lucide-react';
import { ComicGridView } from '@/components/organisms/comic-grid-view';
import { ComicInspector } from '@/components/organisms/comic-inspector';
import { useI18n } from '@/core/i18n/context';
import { POPULAR_GENRES, POPULAR_TROPES, resolveTropeFilters } from '@/core/constants/comic-genres';
import { getComics, findComicByTitle, PAGE_SIZE } from '@/services/comic.service';
import type { BookmarkMap, ReadingStatus } from '@/core/types/bookmark';
import type { ComicSearchResult, ComicType, ComicStatus } from '@/core/types/comic';
import { useComicDeepLink } from '@/lib/hooks/use-comic-deep-link';
import { cn } from '@/lib/utils/cn';

interface CatalogBrowserProps {
  onToggleBookmark: (comicId: string) => void;
  bookmarkedIds: Set<string>;
  bookmarks?: BookmarkMap;
  onUpdateBookmarkStatus?: (id: string, status: ReadingStatus, progress?: number) => void;
}

export function CatalogBrowser({
  onToggleBookmark,
  bookmarkedIds,
  bookmarks = {},
  onUpdateBookmarkStatus,
}: CatalogBrowserProps) {
  const { t } = useI18n();
  const [comics, setComics] = useState<ComicSearchResult[]>([]);
  const [selectedComic, setSelectedComic] = useState<ComicSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  const { pendingSlug: deepLinkSlug } = useComicDeepLink(selectedComic, (found) => {
    setComics((prev) => [found, ...prev.filter((c) => c.id !== found.id)]);
    setSelectedComic(found);
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<ComicType | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<ComicStatus | 'ALL'>('ALL');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [minScore, setMinScore] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'popularity' | 'score' | 'year'>('popularity');

  const activeFiltersCount =
    (selectedType !== 'ALL' ? 1 : 0) +
    (selectedStatus !== 'ALL' ? 1 : 0) +
    (minScore > 0 ? 1 : 0) +
    selectedGenres.length +
    selectedTags.length +
    (searchQuery ? 1 : 0);

  // Guards against a stale in-flight page overwriting a newer filter's results.
  const requestIdRef = useRef(0);
  const pageRef = useRef(1);

  const fetchCatalog = useCallback(
    async (page: number) => {
      const requestId = ++requestIdRef.current;
      if (page === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        // Pills carry friendly labels ("Murim / Cultivation"); the catalog stores
        // raw AniList tag names. Resolve before querying or nothing matches.
        const { tags, excludeGenres } = resolveTropeFilters(selectedTags);

        const data = await getComics({
          query: searchQuery,
          type: selectedType,
          status: selectedStatus,
          genres: selectedGenres.length > 0 ? selectedGenres : undefined,
          tags: tags.length > 0 ? tags : undefined,
          excludeGenres: excludeGenres.length > 0 ? excludeGenres : undefined,
          minScore: minScore > 0 ? minScore : undefined,
          sortBy,
          page,
          limit: PAGE_SIZE,
        });

        if (requestId !== requestIdRef.current) return;

        // A short page means the server has nothing left for these filters.
        setHasMore(data.length === PAGE_SIZE);
        pageRef.current = page;
        setComics((prev) => (page === 1 ? data : [...prev, ...data]));

        // Not while a ?c= link is still resolving — the first card of the
        // default listing is not what the link was about.
        if (
          page === 1 &&
          !deepLinkSlug &&
          data.length > 0 &&
          typeof window !== 'undefined' &&
          window.innerWidth >= 1024
        ) {
          setSelectedComic(data[0]);
        }
      } catch (err) {
        console.error('Error fetching catalog:', err);
        if (requestId === requestIdRef.current) setHasMore(false);
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [searchQuery, selectedType, selectedStatus, selectedGenres, selectedTags, minScore, sortBy]
  );

  // Any filter change restarts paging from the top.
  useEffect(() => {
    const timer = setTimeout(() => {
      setHasMore(true);
      fetchCatalog(1);
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchCatalog]);

  const loadMore = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMore) return;
    fetchCatalog(pageRef.current + 1);
  }, [fetchCatalog, isLoading, isLoadingMore, hasMore]);

  // Community recommendations / franchise relations in the inspector hand back a
  // bare title. Without this the inspector rendered them as clickable rows that
  // did nothing at all — ComicInspector calls `onSelectRelatedTitle?.()`, and
  // only DiscoveryWorkspace ever passed one.
  const handleSelectRelatedTitle = async (title: string) => {
    const lower = title.toLowerCase();
    const alreadyLoaded = comics.find(
      (c) => c.title_english?.toLowerCase() === lower || c.title_romaji?.toLowerCase() === lower
    );
    if (alreadyLoaded) {
      setSelectedComic(alreadyLoaded);
      return;
    }

    const found = await findComicByTitle(title);
    if (!found) return;

    // Surface it in the grid too, so the selection has a visible anchor.
    setComics((prev) => [found, ...prev.filter((c) => c.id !== found.id)]);
    setSelectedComic(found);
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSelectedType('ALL');
    setSelectedStatus('ALL');
    setSelectedGenres([]);
    setSelectedTags([]);
    setMinScore(0);
    setSearchQuery('');
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-56px)] overflow-hidden max-w-[1600px] w-full mx-auto">
      {/* Mobile Filter Toggle Header (< lg) */}
      <div className="lg:hidden flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0">
        <button
          type="button"
          onClick={() => setIsMobileFiltersOpen((prev) => !prev)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] text-xs font-mono-data font-semibold text-[var(--text-primary)] cursor-pointer"
        >
          <Filter className="w-3.5 h-3.5 text-[#ff334b]" />
          <span>
            {t.catalog.filters} {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </span>
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 transition-transform text-[var(--text-muted)]',
              isMobileFiltersOpen && 'rotate-180'
            )}
          />
        </button>

        <div className="flex items-center gap-2 text-xs font-mono-data text-[var(--text-muted)]">
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[11px] text-[#ff334b] underline cursor-pointer"
            >
              {t.catalog.reset}
            </button>
          )}
          <span>
            ({comics.length}
            {hasMore ? '+' : ''})
          </span>
        </div>
      </div>

      {/* Filter Sidebar (Dense, Technical, Collapsible on Mobile, Persistent on Desktop) */}
      <aside
        className={cn(
          'w-full lg:w-60 shrink-0 border-b lg:border-b-0 border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 flex flex-col gap-4 overflow-y-auto max-h-[50vh] lg:max-h-none lg:my-5 lg:ml-5 lg:h-[calc(100%-2.5rem)] lg:rounded-2xl lg:border lg:shadow-xl',
          !isMobileFiltersOpen && 'hidden lg:flex'
        )}
      >
        <div className="flex items-center justify-between font-mono-data text-xs pb-2 border-b border-[var(--border-subtle)]">
          <span className="text-[var(--text-secondary)] font-semibold flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-[#ff334b]" />
            {t.catalog.filters}
          </span>
          <button
            type="button"
            onClick={clearFilters}
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            {t.catalog.reset}
          </button>
        </div>

        {/* Search Field */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.catalog.filterTitle}
            className="w-full pl-8 pr-6 py-1.5 rounded-lg bg-[var(--input-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--text-secondary)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Type Selector */}
        <div className="flex flex-col gap-1.5 font-mono-data text-xs">
          <label className="text-[10px] text-[var(--text-muted)] uppercase">{t.catalog.format}</label>
          <div className="grid grid-cols-2 gap-1">
            {(['ALL', 'MANHWA', 'MANGA', 'MANHUA'] as const).map((tType) => (
              <button
                key={tType}
                type="button"
                onClick={() => setSelectedType(tType)}
                className={cn(
                  'px-2 py-1 rounded text-[11px] border text-center transition-colors cursor-pointer',
                  selectedType === tType
                    ? 'bg-[var(--bg-surface-raised)] text-[var(--text-primary)] border-[var(--border-muted)] font-bold'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-raised)]'
                )}
              >
                {tType === 'ALL' ? t.common.all : tType}
              </button>
            ))}
          </div>
        </div>

        {/* Status Selector */}
        <div className="flex flex-col gap-1.5 font-mono-data text-xs">
          <label className="text-[10px] text-[var(--text-muted)] uppercase">{t.catalog.status}</label>
          <div className="flex gap-1">
            {(['ALL', 'RELEASING', 'FINISHED'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={cn(
                  'flex-1 px-1.5 py-1 rounded text-[10px] border text-center transition-colors cursor-pointer',
                  selectedStatus === st
                    ? 'bg-[var(--bg-surface-raised)] text-[var(--text-primary)] border-[var(--border-muted)] font-bold'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-raised)]'
                )}
              >
                {st === 'ALL' ? t.common.all : st === 'RELEASING' ? t.common.ongoing : t.common.finished}
              </button>
            ))}
          </div>
        </div>

        {/* Rating Slider */}
        <div className="flex flex-col gap-1.5 font-mono-data text-xs">
          <div className="flex justify-between items-center text-[10px] text-[var(--text-muted)] uppercase">
            <span>{t.catalog.minRating}</span>
            <span className="text-amber-500 font-bold">
              {minScore > 0 ? `${(minScore / 10).toFixed(1)}+` : t.common.all}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="95"
            step="5"
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-full accent-[#ff334b] cursor-pointer"
          />
        </div>

        {/* Genres */}
        <div className="flex flex-col gap-1.5 text-xs">
          <label className="text-[10px] text-[var(--text-muted)] uppercase font-mono-data">
            {t.catalog.genres} {selectedGenres.length > 0 && `(${selectedGenres.length})`}
          </label>
          <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto pr-1">
            {POPULAR_GENRES.map((genre) => {
              const isSelected = selectedGenres.includes(genre);
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => toggleGenre(genre)}
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer select-none',
                    isSelected
                      ? 'bg-[var(--bg-surface-raised)] text-[var(--text-primary)] border-[var(--border-muted)] font-medium'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                  )}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tropes & Themes (Murim, Regression, System, etc.) */}
        <div className="flex flex-col gap-1.5 text-xs">
          <label className="text-[10px] text-[var(--text-muted)] uppercase font-mono-data">
            {t.catalog.tropes} {selectedTags.length > 0 && `(${selectedTags.length})`}
          </label>
          <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto pr-1">
            {POPULAR_TROPES.map((trope) => {
              const isSelected = selectedTags.includes(trope.label);
              return (
                <button
                  key={trope.label}
                  type="button"
                  onClick={() => toggleTag(trope.label)}
                  title={trope.tags?.join(', ')}
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer select-none',
                    isSelected
                      ? 'bg-[#ff334b]/15 text-[#ff334b] border-[#ff334b]/40 font-medium'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                  )}
                >
                  {trope.label}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main Grid View */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto px-4 sm:px-6 py-4 gap-4 pb-24 lg:pb-8">
        <div className="flex items-center justify-between text-xs font-mono-data text-[var(--text-muted)] pb-2 border-b border-[var(--border-subtle)]">
          <span>
            {t.catalog.filters} {t.common.results} ({comics.length}
            {hasMore ? '+' : ''})
          </span>
          <div className="flex items-center gap-2">
            <span>{t.catalog.sort}:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[var(--input-bg)] border border-[var(--border-subtle)] text-[var(--text-primary)] px-2 py-0.5 rounded text-xs focus:outline-none cursor-pointer"
            >
              <option value="popularity">{t.catalog.sortPopularity}</option>
              <option value="score">{t.catalog.sortScore}</option>
              <option value="year">{t.catalog.sortYear}</option>
            </select>
          </div>
        </div>

        <div className="flex-1 pb-8">
          <ComicGridView
            comics={comics}
            selectedId={selectedComic?.id || null}
            onSelect={(comic) => setSelectedComic(comic)}
            onToggleBookmark={onToggleBookmark}
            bookmarkedIds={bookmarkedIds}
            isLoading={isLoading}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMore}
          />
        </div>
      </main>

      {/* Master-Detail Inspector */}
      {selectedComic && (
        <ComicInspector
          comic={selectedComic}
          onClose={() => setSelectedComic(null)}
          onToggleBookmark={onToggleBookmark}
          isBookmarked={bookmarkedIds.has(selectedComic.id)}
          bookmarkItem={bookmarks[selectedComic.id] || null}
          onUpdateBookmarkStatus={onUpdateBookmarkStatus}
          onSelectRelatedTitle={handleSelectRelatedTitle}
        />
      )}
    </div>
  );
}
