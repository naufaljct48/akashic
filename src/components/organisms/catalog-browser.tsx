import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Filter, ChevronDown } from 'lucide-react';
import { PrintedSelect } from '@/components/molecules/printed-select';
import { ComicGridView } from '@/components/organisms/comic-grid-view';
import { ComicInspector } from '@/components/organisms/comic-inspector';
import { Folio } from '@/components/molecules/folio';
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
    <div
      className="flex flex-col lg:flex-row h-[var(--view-h)] overflow-hidden max-w-[1600px] w-full mx-auto"
      style={{ ['--spot' as string]: 'var(--ink-blue)' }}
    >
      {/* Mobile: the index opens on demand */}
      <div className="lg:hidden flex items-center justify-between gap-3 px-3.5 py-2 border-b border-[var(--rule)] shrink-0">
        <button
          type="button"
          onClick={() => setIsMobileFiltersOpen((prev) => !prev)}
          className="stamp flex items-center gap-1.5 py-1.5 text-[9px] border-b-2 border-[var(--ink)] text-[var(--ink)] cursor-pointer"
        >
          <Filter className="w-3.5 h-3.5" />
          <span>
            {t.catalog.filters}
            {activeFiltersCount > 0 && ` (${activeFiltersCount})`}
          </span>
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isMobileFiltersOpen && 'rotate-180')} />
        </button>

        <div className="stamp figures flex items-center gap-2.5 text-[9px] text-[var(--ink-faint)]">
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[var(--spot-text)] underline cursor-pointer"
            >
              {t.catalog.reset}
            </button>
          )}
          <span>
            {comics.length}
            {hasMore ? '+' : ''}
          </span>
        </div>
      </div>

      {/* The index margin */}
      <aside
        className={cn(
          'w-full lg:w-64 shrink-0 overflow-y-auto max-h-[52vh] lg:max-h-none lg:h-full',
          'px-3.5 sm:px-6 lg:pl-6 lg:pr-5 py-4 lg:py-5 lg:border-r border-b lg:border-b-0 border-[var(--rule)]',
          !isMobileFiltersOpen && 'hidden lg:block'
        )}
      >
        <div className="flex items-baseline justify-between gap-2 pb-2 mb-4 border-b-2 border-[var(--ink)]">
          <h2 className="masthead text-lg text-[var(--ink)]">{t.catalog.filters}</h2>
          <button
            type="button"
            onClick={clearFilters}
            className="stamp text-[9px] text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors cursor-pointer"
          >
            {t.catalog.reset}
          </button>
        </div>

        {/* Title filter */}
        <div className="relative mb-5">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.catalog.filterTitle}
            aria-label={t.catalog.filterTitle}
            className="field-ruled w-full pl-7 pr-6 py-1.5 bg-transparent text-[13px] text-[var(--ink)] placeholder-[var(--ink-faint)] focus:outline-none"
          />
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ink-faint)] pointer-events-none" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] hover:text-[var(--ink)] cursor-pointer"
              aria-label={t.catalog.reset}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Format */}
        <div className="mb-5">
          <p className="stamp text-[9px] text-[var(--ink-faint)] pb-1.5 mb-2 border-b border-[var(--rule)]">
            {t.catalog.format}
          </p>
          <div className="grid grid-cols-2 gap-1">
            {(['ALL', 'MANHWA', 'MANGA', 'MANHUA'] as const).map((tType) => (
              <button
                key={tType}
                type="button"
                onClick={() => setSelectedType(tType)}
                className={cn(
                  'stamp px-1 py-1.5 text-[9px] text-left border-b-2 transition-colors cursor-pointer',
                  selectedType === tType
                    ? 'text-[var(--ink)] border-[var(--ink)]'
                    : 'text-[var(--ink-faint)] border-[var(--rule)] hover:text-[var(--ink)]'
                )}
              >
                {tType === 'ALL' ? t.common.all : tType}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="mb-5">
          <p className="stamp text-[9px] text-[var(--ink-faint)] pb-1.5 mb-2 border-b border-[var(--rule)]">
            {t.catalog.status}
          </p>
          <div className="flex gap-1">
            {(['ALL', 'RELEASING', 'FINISHED'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={cn(
                  'stamp flex-1 px-1 py-1.5 text-[9px] border-b-2 transition-colors cursor-pointer',
                  selectedStatus === st
                    ? 'text-[var(--ink)] border-[var(--ink)]'
                    : 'text-[var(--ink-faint)] border-[var(--rule)] hover:text-[var(--ink)]'
                )}
              >
                {st === 'ALL' ? t.common.all : st === 'RELEASING' ? t.common.ongoing : t.common.finished}
              </button>
            ))}
          </div>
        </div>

        {/* Minimum rating */}
        <div className="mb-5">
          <div className="flex items-baseline justify-between pb-1.5 mb-2 border-b border-[var(--rule)]">
            <p className="stamp text-[9px] text-[var(--ink-faint)]">{t.catalog.minRating}</p>
            <span className="stamp figures text-[9px] text-[var(--spot-text)]">
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
            aria-label={t.catalog.minRating}
            className="w-full cursor-pointer"
          />
        </div>

        {/* Genres */}
        <div className="mb-5">
          <p className="stamp text-[9px] text-[var(--ink-faint)] pb-1.5 mb-2 border-b border-[var(--rule)]">
            {t.catalog.genres}
            {selectedGenres.length > 0 && ` (${selectedGenres.length})`}
          </p>
          <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto pr-1">
            {POPULAR_GENRES.map((genre) => {
              const isSelected = selectedGenres.includes(genre);
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => toggleGenre(genre)}
                  className={cn(
                    'text-[12px] px-1 py-0.5 leading-tight transition-colors cursor-pointer select-none',
                    isSelected
                      ? 'bg-[var(--ink)] text-[var(--paper)]'
                      : 'text-[var(--ink-soft)] hover:text-[var(--ink)] underline decoration-[var(--rule)] hover:decoration-[var(--ink)]'
                  )}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tropes */}
        <div className="pb-4">
          <p className="stamp text-[9px] text-[var(--ink-faint)] pb-1.5 mb-2 border-b border-[var(--rule)]">
            {t.catalog.tropes}
            {selectedTags.length > 0 && ` (${selectedTags.length})`}
          </p>
          <div className="flex flex-wrap gap-1 max-h-52 overflow-y-auto pr-1">
            {POPULAR_TROPES.map((trope) => {
              const isSelected = selectedTags.includes(trope.label);
              return (
                <button
                  key={trope.label}
                  type="button"
                  onClick={() => toggleTag(trope.label)}
                  title={trope.tags?.join(', ')}
                  className={cn(
                    'text-[12px] px-1 py-0.5 leading-tight transition-colors cursor-pointer select-none',
                    isSelected
                      ? 'bg-[var(--spot)] text-[var(--on-spot)]'
                      : 'text-[var(--ink-soft)] hover:text-[var(--ink)] underline decoration-[var(--rule)] hover:decoration-[var(--ink)]'
                  )}
                >
                  {trope.label}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* The listing */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto px-3.5 sm:px-6 py-5 gap-4 pb-28 lg:pb-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 pb-2.5 border-b-2 border-[var(--ink)]">
          <h2 className="masthead text-[clamp(1.1rem,2.4vw,1.5rem)] text-[var(--ink)]">
            {t.nav.catalog}
          </h2>
          <div className="flex items-center gap-4">
            <span className="stamp figures text-[9px] text-[var(--ink-faint)]">
              {comics.length}
              {hasMore ? '+' : ''} {t.common.results}
            </span>
            <div className="stamp flex items-center gap-2 text-[9px] text-[var(--ink-faint)]">
              <span>{t.catalog.sort}</span>
              <PrintedSelect
                label={t.catalog.sort}
                value={sortBy}
                onChange={setSortBy}
                options={[
                  { value: 'popularity' as const, label: t.catalog.sortPopularity },
                  { value: 'score' as const, label: t.catalog.sortScore },
                  { value: 'year' as const, label: t.catalog.sortYear },
                ]}
                className="min-w-[8.5rem]"
              />
            </div>
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

          <Folio section={t.nav.catalog} tally={`${comics.length}${hasMore ? '+' : ''}`} />
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
