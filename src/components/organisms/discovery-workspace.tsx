import { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Flame, Zap, Calendar } from 'lucide-react';
import { CommandSearchBar } from '@/components/organisms/command-search-bar';
import { AboutAkashicBanner } from '@/components/molecules/about-akashic-banner';
import { ComicGridView } from '@/components/organisms/comic-grid-view';
import { ComicInspector } from '@/components/organisms/comic-inspector';
import { useI18n } from '@/core/i18n/context';
import { searchComicsSemantic, getComics, getRandomGemComic, PAGE_SIZE } from '@/services/comic.service';
import {
  fetchTrendingWindow,
  fetchLiveRecentlyUpdated,
  fetchLiveNewReleases,
  type TrendingWindow,
} from '@/services/anilist-live.service';
import { getRateLimitStatus, incrementRateLimit } from '@/services/rate-limit.service';
import type { BookmarkMap, ReadingStatus } from '@/core/types/bookmark';
import type { ComicSearchResult, ComicType } from '@/core/types/comic';
import { cn } from '@/lib/utils/cn';

export type FeedMode = 'curated' | 'trending' | 'recent_updates' | 'new_releases';

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
  const [query, setQuery] = useState(initialPrompt || '');
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
    page = 1
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
    if (initialPrompt && initialPrompt.trim()) {
      handleSearch(initialPrompt);
      return;
    }
    loadFeedData(feedMode, selectedType);
  }, [initialPrompt]);

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
    requestIdRef.current++;
    pageRef.current = 1;
    setHasMore(false);

    try {
      const typeFilter = selectedType !== 'ALL' ? selectedType : undefined;
      const { summary, results: searchData } = await searchComicsSemantic(
        trimmed,
        typeFilter,
        locale
      );

      setResults(searchData);
      setAiSummary(summary || null);

      if (searchData.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 1024) {
        setSelectedComic(searchData[0]);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
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
      const matches = await getComics({ query: title, limit: 10 });
      if (matches.length > 0) {
        const topMatch = matches[0] as ComicSearchResult;
        setResults((prev) => [topMatch, ...prev.filter((p) => p.id !== topMatch.id)]);
        setSelectedComic(topMatch);
      } else {
        handleSearch(title);
      }
    } catch (err) {
      console.error('Failed to open related title:', err);
    }
  };

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

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-56px)] overflow-hidden max-w-[1600px] w-full mx-auto">
      {/* Main Left/Center Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto px-3.5 sm:px-6 py-4 sm:py-5 gap-4 sm:gap-5 pb-24 lg:pb-8">
        {/* What is Akashic Dex Explanatory Banner */}
        <AboutAkashicBanner />

        {/* Command Search Bar */}
        <CommandSearchBar
          query={query}
          onQueryChange={setQuery}
          onSubmit={(q) => handleSearch(q)}
          selectedType={selectedType}
          onTypeChange={handleTypeChange}
          isLoading={isLoading}
          rateLimitRemaining={rateLimit.remaining}
          onSurpriseMe={handleSurpriseMe}
          isRollingGacha={isRollingGacha}
        />

        {/* Live Feed Mode Selector & Live Status Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono-data text-xs overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => handleFeedModeChange('curated')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap',
                feedMode === 'curated' && !activeSearchIntent
                  ? 'bg-[var(--bg-surface-raised)] text-[var(--text-primary)] font-semibold shadow-xs border border-[var(--border-muted)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#ff334b]" />
              <span>{t.feeds.curated}</span>
            </button>

            <button
              type="button"
              onClick={() => handleFeedModeChange('trending')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer',
                feedMode === 'trending'
                  ? 'bg-[#ff334b]/15 text-[#ff334b] font-semibold border border-[#ff334b]/40 shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              <span>{t.feeds.trending}</span>
            </button>

            <button
              type="button"
              onClick={() => handleFeedModeChange('recent_updates')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer',
                feedMode === 'recent_updates'
                  ? 'bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/40 shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.feeds.recentUpdates}</span>
            </button>

            <button
              type="button"
              onClick={() => handleFeedModeChange('new_releases')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer',
                feedMode === 'new_releases'
                  ? 'bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/40 shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.feeds.newReleases}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Trending time window — only meaningful for the trending feed. */}
            {feedMode === 'trending' && !activeSearchIntent && (
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono-data text-[11px]">
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
                      'px-2 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap',
                      trendingWindow === value
                        ? 'bg-[#ff334b]/15 text-[#ff334b] font-semibold'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {feedMode !== 'curated' && !activeSearchIntent && (
              <div className="flex items-center gap-2 text-[11px] font-mono-data text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{t.feeds.liveBadge}</span>
              </div>
            )}
          </div>
        </div>

        {/* Clean AI Discovery Insight Banner */}
        {activeSearchIntent && (
          <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-start justify-between gap-3 text-xs shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-[#ff334b]/10 border border-[#ff334b]/30 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-[#ff334b]" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 font-mono-data text-xs">
                  <span className="font-semibold text-[var(--text-primary)]">
                    {t.search.semanticMatch}: <span className="text-[var(--text-secondary)] font-normal italic">"{activeSearchIntent}"</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] text-[#ff334b] font-bold">
                    {t.search.titlesCount(results.length)}
                  </span>
                </div>
                {aiSummary && (
                  <p className="text-[var(--text-secondary)] font-jakarta leading-relaxed mt-0.5">
                    {aiSummary}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                setActiveSearchIntent(null);
                setAiSummary(null);
                setQuery('');
                await loadFeedData(feedMode, selectedType, trendingWindow, 1);
              }}
              className="text-[11px] font-mono-data text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0 underline cursor-pointer"
            >
              {t.search.resetQuery}
            </button>
          </div>
        )}

        {/* Comic Grid */}
        <div className="flex-1 pb-8">
          <div className="flex items-center justify-between mb-3 text-xs font-mono-data text-[var(--text-muted)]">
            <span>
              {t.common.results} ({results.length}
              {hasMore && !activeSearchIntent ? '+' : ''})
            </span>
            <span>{t.common.clickToInspect}</span>
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
        </div>
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
