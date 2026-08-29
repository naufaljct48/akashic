import { useState, useEffect, useRef, useCallback } from 'react';
import { Newspaper, Flame, Zap, Calendar } from 'lucide-react';
import { CommandSearchBar } from '@/components/organisms/command-search-bar';
import { FrontPageMasthead } from '@/components/molecules/front-page-masthead';
import { Folio } from '@/components/molecules/folio';
import { ComicGridView } from '@/components/organisms/comic-grid-view';
import { ComicInspector } from '@/components/organisms/comic-inspector';
import { useI18n } from '@/core/i18n/context';
import {
  searchComicsSemantic,
  getComics,
  getRandomGemComic,
  findComicByTitle,
  PAGE_SIZE,
} from '@/services/comic.service';
import {
  fetchTrendingWindow,
  fetchLiveRecentlyUpdated,
  fetchLiveNewReleases,
  type TrendingWindow,
} from '@/services/anilist-live.service';
import {
  getRateLimitStatus,
  incrementRateLimit,
  MAX_DAILY_PROMPTS,
} from '@/services/rate-limit.service';
import type { BookmarkMap, ReadingStatus } from '@/core/types/bookmark';
import type { ComicSearchResult, ComicType } from '@/core/types/comic';
import { useComicDeepLink } from '@/lib/hooks/use-comic-deep-link';
import { cn } from '@/lib/utils/cn';

export type FeedMode = 'curated' | 'trending' | 'recent_updates' | 'new_releases';

/**
 * One spot color per department, set on the view root so every rule, tab, and
 * numeral inside it inherits the same ink. Switching feeds re-inks the page.
 */
const FEED_INK: Record<FeedMode, string> = {
  curated: 'var(--ink-magenta)',
  trending: 'var(--ink-vermilion)',
  recent_updates: 'var(--ink-cyan)',
  new_releases: 'var(--ink-green)',
};

interface DiscoveryWorkspaceProps {
  onToggleBookmark: (id: string) => void;
  bookmarkedIds: Set<string>;
  bookmarks?: BookmarkMap;
  onUpdateBookmarkStatus?: (id: string, status: ReadingStatus, progress?: number) => void;
  externalSelectedComic?: ComicSearchResult | null;
  initialPrompt?: string;
}

export function DiscoveryWorkspace({
  onToggleBookmark,
  bookmarkedIds,
  bookmarks = {},
  onUpdateBookmarkStatus,
  externalSelectedComic,
  initialPrompt,
}: DiscoveryWorkspaceProps) {
  const { locale, t } = useI18n();
  // ?q=<query> replays an AI search from a shared link. Read once, lazily: the
  // writer effect below would otherwise feed the hook its own output.
  const [urlQuery] = useState(() =>
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('q')
  );
  const seedPrompt = initialPrompt || urlQuery || '';

  const [query, setQuery] = useState(seedPrompt);
  const [feedMode, setFeedMode] = useState<FeedMode>('curated');
  const [trendingWindow, setTrendingWindow] = useState<TrendingWindow>('today');
  const [activeSearchIntent, setActiveSearchIntent] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<ComicType | 'ALL'>('ALL');
  const [results, setResults] = useState<ComicSearchResult[]>([]);
  const [selectedComic, setSelectedComic] = useState<ComicSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRollingGacha, setIsRollingGacha] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [rateLimit, setRateLimit] = useState(getRateLimitStatus());

  const { pendingSlug: deepLinkSlug } = useComicDeepLink(selectedComic, (found) => {
    setResults((prev) => [found, ...prev.filter((p) => p.id !== found.id)]);
    setSelectedComic(found);
  });

  // Paging state. Refs, not state, so loadMore never fires against a stale page.
  const pageRef = useRef(1);
  const requestIdRef = useRef(0);

  const getCountryCode = (type: ComicType | 'ALL'): 'KR' | 'JP' | 'CN' | undefined => {
    if (type === 'MANHWA') return 'KR';
    if (type === 'MANHUA') return 'CN';
    if (type === 'MANGA') return 'JP';
    return undefined;
  };

  const fetchFeedPage = async (
    mode: FeedMode,
    type: ComicType | 'ALL',
    window: TrendingWindow,
    page: number
  ): Promise<ComicSearchResult[]> => {
    const country = getCountryCode(type);
    if (mode === 'trending') {
      return fetchTrendingWindow(window, country, PAGE_SIZE, page);
    }
    if (mode === 'recent_updates') {
      return fetchLiveRecentlyUpdated(country, PAGE_SIZE, page);
    }
    if (mode === 'new_releases') {
      return fetchLiveNewReleases(country, PAGE_SIZE, page);
    }
    return getComics({
      type: type !== 'ALL' ? type : undefined,
      limit: PAGE_SIZE,
      page,
    });
  };

  const loadFeedData = async (
    mode: FeedMode,
    type: ComicType | 'ALL',
    trendWindow: TrendingWindow = trendingWindow,
    page = 1,
    /**
     * Whether this load may take over the inspector.
     *
     * False when something has already been chosen for us — picking a title in
     * the global spotlight while on another tab mounts this component fresh,
     * which fires BOTH the external-selection effect and the initial feed load.
     * The feed load resolves seconds later and used to overwrite the inspector
     * with whatever happened to be first in the curated feed.
     */
    autoSelect = true
  ) => {
    const requestId = ++requestIdRef.current;
    if (page === 1) {
      setIsLoading(true);
      setHasMore(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const data = await fetchFeedPage(mode, type, trendWindow, page);
      if (requestId !== requestIdRef.current) return;

      // A short page means the source is exhausted for this feed.
      setHasMore(data.length === PAGE_SIZE);
      pageRef.current = page;

      // AniList feeds can repeat a title across pages when its rank shifts
      // mid-scroll; dedupe so React keys stay unique.
      setResults((prev) => {
        if (page === 1) return data;
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...data.filter((c) => !seen.has(c.id))];
      });

      if (
        page === 1 &&
        autoSelect &&
        data.length > 0 &&
        typeof window !== 'undefined' &&
        window.innerWidth >= 1024
      ) {
        setSelectedComic(data[0]);
      }
    } catch (err) {
      console.error('Failed to load feed data:', err);
      if (requestId === requestIdRef.current) setHasMore(false);
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  };

  // Search results are one AI response, not a paged source — nothing to append.
  const loadMore = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMore || activeSearchIntent) return;
    loadFeedData(feedMode, selectedType, trendingWindow, pageRef.current + 1);
  }, [
    isLoading,
    isLoadingMore,
    hasMore,
    activeSearchIntent,
    feedMode,
    selectedType,
    trendingWindow,
  ]);

  // Listen to external selection (e.g. from Global Navbar Spotlight Search)
  useEffect(() => {
    if (externalSelectedComic) {
      setResults((prev) => [
        externalSelectedComic,
        ...prev.filter((p) => p.id !== externalSelectedComic.id),
      ]);
      setSelectedComic(externalSelectedComic);
    }
  }, [externalSelectedComic]);

  // Initial load or execute initialPrompt
  useEffect(() => {
    if (seedPrompt.trim()) {
      handleSearch(seedPrompt);
      return;
    }
    // A spotlight pick arrives with this component's very first render; don't
    // let the feed that loads behind it steal the inspector.
    loadFeedData(
      feedMode,
      selectedType,
      trendingWindow,
      1,
      !externalSelectedComic && !deepLinkSlug
    );
  }, [seedPrompt]);

  // Handle Semantic Discovery Query (AI Powered)
  const handleSearch = async (searchPrompt: string) => {
    const trimmed = searchPrompt.trim();
    if (!trimmed || isLoading) return;

    const currentLimit = getRateLimitStatus();
    if (!currentLimit.allowed) {
      return;
    }

    const updatedLimit = incrementRateLimit();
    setRateLimit(updatedLimit);

    setIsLoading(true);
    setActiveSearchIntent(trimmed);
    // Claim this request. loadFeedData already guards on this ref; the search
    // path incremented it and never checked it, so whichever search RESOLVED
    // last won — a slow first query could wipe the results of the one typed
    // after it, and an errored duplicate could blank a good answer outright.
    const requestId = ++requestIdRef.current;
    pageRef.current = 1;
    setHasMore(false);

    try {
      const typeFilter = selectedType !== 'ALL' ? selectedType : undefined;
      const { summary, results: searchData } = await searchComicsSemantic(
        trimmed,
        typeFilter,
        locale
      );

      if (requestId !== requestIdRef.current) return;

      setResults(searchData);
      setAiSummary(summary || null);

      if (searchData.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 1024) {
        setSelectedComic(searchData[0]);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  };

  // Instant 0-Token Selection for Community Recommendations / Relations
  const handleSelectRelatedTitle = async (title: string) => {
    const existing = results.find(
      (c) =>
        c.title_english?.toLowerCase() === title.toLowerCase() ||
        c.title_romaji?.toLowerCase() === title.toLowerCase()
    );

    if (existing) {
      setSelectedComic(existing);
      return;
    }

    try {
      // Was falling back to a full AI search, which spends a daily quota prompt
      // just to open a title the user already pointed at. findComicByTitle hits
      // the catalog and then AniList directly — no model involved.
      const found = await findComicByTitle(title);
      if (found) {
        setResults((prev) => [found, ...prev.filter((p) => p.id !== found.id)]);
        setSelectedComic(found);
      }
    } catch (err) {
      console.error('Failed to open related title:', err);
    }
  };

  // The search itself is the shareable thing here, not just the title it landed
  // on. Held back until the seeded search registers, so copying the URL while it
  // is still running does not hand out a link with the query stripped out.
  const searchSyncReady = useRef(!seedPrompt);
  useEffect(() => {
    if (activeSearchIntent) searchSyncReady.current = true;
    if (!searchSyncReady.current) return;
    const url = new URL(window.location.href);
    if (activeSearchIntent) url.searchParams.set('q', activeSearchIntent);
    else url.searchParams.delete('q');
    window.history.replaceState(null, '', url);
  }, [activeSearchIntent]);

  const handleFeedModeChange = async (mode: FeedMode) => {
    setFeedMode(mode);
    setActiveSearchIntent(null);
    setAiSummary(null);
    await loadFeedData(mode, selectedType, trendingWindow, 1);
  };

  const handleTrendingWindowChange = async (nextWindow: TrendingWindow) => {
    setTrendingWindow(nextWindow);
    setActiveSearchIntent(null);
    setAiSummary(null);
    await loadFeedData('trending', selectedType, nextWindow, 1);
  };

  const handleTypeChange = async (newType: ComicType | 'ALL') => {
    setSelectedType(newType);
    if (activeSearchIntent) {
      setIsLoading(true);
      try {
        const typeFilter = newType !== 'ALL' ? newType : undefined;
        const { summary, results: searchData } = await searchComicsSemantic(
          activeSearchIntent,
          typeFilter,
          locale
        );
        setResults(searchData);
        setAiSummary(summary || null);
        if (searchData.length > 0) setSelectedComic(searchData[0]);
      } finally {
        setIsLoading(false);
      }
    } else {
      await loadFeedData(feedMode, newType, trendingWindow, 1);
    }
  };

  const handleSurpriseMe = async () => {
    setIsRollingGacha(true);
    try {
      const randomComic = await getRandomGemComic(selectedType);
      if (randomComic) {
        setSelectedComic(randomComic);
        setResults((prev) => {
          const exists = prev.some((c) => c.id === randomComic.id);
          return exists ? prev : [randomComic, ...prev];
        });
      }
    } catch (err) {
      console.error('Gacha error:', err);
    } finally {
      setTimeout(() => setIsRollingGacha(false), 500);
    }
  };

  const feeds: { id: FeedMode; label: string; icon: typeof Flame }[] = [
    { id: 'curated', label: t.feeds.curated, icon: Newspaper },
    { id: 'trending', label: t.feeds.trending, icon: Flame },
    { id: 'recent_updates', label: t.feeds.recentUpdates, icon: Zap },
    { id: 'new_releases', label: t.feeds.newReleases, icon: Calendar },
  ];

  return (
    <div
      className="flex flex-col lg:flex-row h-[var(--view-h)] overflow-hidden max-w-[1600px] w-full mx-auto"
      style={{ ['--spot' as string]: activeSearchIntent ? FEED_INK.curated : FEED_INK[feedMode] }}
    >
      <main className="flex-1 flex flex-col h-full overflow-y-auto px-3.5 sm:px-6 py-5 gap-5 pb-28 lg:pb-10">
        <FrontPageMasthead />

        <CommandSearchBar
          query={query}
          onQueryChange={setQuery}
          onSubmit={(q) => handleSearch(q)}
          selectedType={selectedType}
          onTypeChange={handleTypeChange}
          isLoading={isLoading}
          rateLimitRemaining={rateLimit.remaining}
          maxRateLimit={MAX_DAILY_PROMPTS}
          onSurpriseMe={handleSurpriseMe}
          isRollingGacha={isRollingGacha}
        />

        {/* The issue's departments. Each keeps its own ink wherever it appears. */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b-2 border-[var(--ink)]">
          <nav className="scroll-fade flex items-stretch gap-4 sm:gap-6 overflow-x-auto -mb-[2px] pr-6">
            {feeds.map((feed) => {
              const isActive = feedMode === feed.id && !activeSearchIntent;
              const Icon = feed.icon;
              return (
                <button
                  key={feed.id}
                  type="button"
                  onClick={() => handleFeedModeChange(feed.id)}
                  style={{ ['--spot' as string]: FEED_INK[feed.id] }}
                  className={cn(
                    'stamp flex items-center gap-1.5 pb-2 text-[10px] whitespace-nowrap border-b-[3px] transition-colors cursor-pointer',
                    isActive
                      ? 'text-[var(--ink)] border-[var(--spot)]'
                      : 'text-[var(--ink-faint)] border-transparent hover:text-[var(--ink)]'
                  )}
                >
                  <Icon className={cn('w-3.5 h-3.5', isActive && 'text-[var(--spot-text)]')} />
                  <span>{feed.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 pb-2">
            {/* Trending time window — only meaningful for the trending feed. */}
            {feedMode === 'trending' && !activeSearchIntent && (
              <div className="flex items-center gap-1">
                <span className="stamp text-[9px] text-[var(--ink-faint)] mr-1">
                  {t.feeds.windowLabel}
                </span>
                {(
                  [
                    ['today', t.feeds.windowToday],
                    ['week', t.feeds.windowWeek],
                    ['month', t.feeds.windowMonth],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleTrendingWindowChange(value)}
                    className={cn(
                      'stamp px-1.5 py-0.5 text-[9px] whitespace-nowrap transition-colors cursor-pointer border',
                      trendingWindow === value
                        ? 'bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)]'
                        : 'border-[var(--rule)] text-[var(--ink-faint)] hover:text-[var(--ink)] hover:border-[var(--ink)]'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {feedMode !== 'curated' && !activeSearchIntent && (
              <span className="stamp flex items-center gap-1.5 text-[9px] text-[var(--ink-green)]">
                <span className="ink-pulse w-1.5 h-1.5 bg-[var(--ink-green)]" aria-hidden />
                <span>{t.feeds.liveBadge}</span>
              </span>
            )}
          </div>
        </div>

        {/* When a search is live, the desk's answer runs as the issue's lede. */}
        {activeSearchIntent && (
          <div className="border-t-[3px] border-[var(--spot)] pt-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="stamp text-[9px] text-[var(--spot-text)]">
                {t.search.semanticMatch} — {t.search.titlesCount(results.length)}
              </p>
              <button
                type="button"
                onClick={async () => {
                  setActiveSearchIntent(null);
                  setAiSummary(null);
                  setQuery('');
                  await loadFeedData(feedMode, selectedType, trendingWindow, 1);
                }}
                className="stamp text-[9px] text-[var(--ink-faint)] hover:text-[var(--ink)] underline transition-colors cursor-pointer"
              >
                {t.search.resetQuery}
              </button>
            </div>

            <p className="text-[15px] sm:text-base text-[var(--ink)] leading-snug mt-1.5 max-w-[62ch]">
              “{activeSearchIntent}”
            </p>

            {aiSummary && (
              <p className="text-[13px] text-[var(--ink-soft)] leading-relaxed mt-2 max-w-[68ch]">
                {aiSummary}
              </p>
            )}
          </div>
        )}

        {/* The ranking */}
        <section className="flex-1 pb-8">
          <div className="flex items-baseline justify-between gap-3 mb-3.5">
            <h2 className="masthead text-[clamp(1.1rem,2.4vw,1.5rem)] text-[var(--ink)]">
              {activeSearchIntent ? t.search.semanticMatch : t.common.results}
            </h2>
            <span className="stamp figures text-[10px] text-[var(--ink-faint)]">
              {results.length}
              {hasMore && !activeSearchIntent ? '+' : ''}
              {/* A pointer hint has no meaning on a touch viewport. */}
              <span className="hidden sm:inline"> · {t.common.clickToInspect}</span>
            </span>
          </div>

          <ComicGridView
            comics={results}
            selectedId={selectedComic?.id || null}
            onSelect={(comic) => setSelectedComic(comic)}
            onToggleBookmark={onToggleBookmark}
            bookmarkedIds={bookmarkedIds}
            isLoading={isLoading}
            hasMore={hasMore && !activeSearchIntent}
            isLoadingMore={isLoadingMore}
            onLoadMore={activeSearchIntent ? undefined : loadMore}
          />

          <Folio
            section={activeSearchIntent ? t.search.semanticMatch : t.feeds[
              feedMode === 'curated'
                ? 'curated'
                : feedMode === 'trending'
                  ? 'trending'
                  : feedMode === 'recent_updates'
                    ? 'recentUpdates'
                    : 'newReleases'
            ]}
            tally={`${results.length}${hasMore && !activeSearchIntent ? '+' : ''}`}
          />
        </section>
      </main>

      {/* Right Master-Detail Inspector Panel */}
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
