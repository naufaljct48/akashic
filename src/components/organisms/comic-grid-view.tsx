import { useState, useEffect, useRef } from 'react';
import { Bookmark, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ComicGridSkeleton } from '@/components/ui/comic-card-skeleton';
import { useI18n } from '@/core/i18n/context';
import { fetchFreshCoverFromAniList } from '@/services/anilist-live.service';
import { useInfiniteScroll } from '@/lib/hooks/use-infinite-scroll';
import type { ComicSearchResult } from '@/core/types/comic';
import { cn } from '@/lib/utils/cn';

interface ComicGridViewProps {
  comics: ComicSearchResult[];
  selectedId: string | null;
  onSelect: (comic: ComicSearchResult) => void;
  onToggleBookmark: (id: string) => void;
  bookmarkedIds: Set<string>;
  isLoading?: boolean;
  /** Infinite scroll. Omit `onLoadMore` for a fixed-length grid. */
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

function LazyCoverImage({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setCurrentSrc(src);
    setHasError(false);
    setLoaded(false);
  }, [src]);

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [currentSrc]);

  const handleError = async () => {
    if (hasError) return;
    setHasError(true);
    // Auto-heal by searching AniList live
    const fresh = await fetchFreshCoverFromAniList(alt);
    if (fresh && fresh !== currentSrc) {
      setCurrentSrc(fresh);
      setHasError(false);
    } else {
      setLoaded(true);
    }
  };

  if (!currentSrc || (hasError && !currentSrc)) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-xs font-mono-data bg-[var(--bg-surface-raised)]">
        No Cover
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-[var(--bg-surface-raised)] overflow-hidden flex items-center justify-center">
      {!loaded && !hasError && <div className="absolute inset-0 shimmer-element" />}
      <img
        ref={imgRef}
        key={currentSrc}
        src={currentSrc}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={handleError}
        className={cn(
          'w-full h-full object-cover transition-all duration-300 ease-out',
          loaded && !hasError ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
          className
        )}
      />
      {hasError && (
        <span className="text-xs font-mono-data text-[var(--text-muted)]">No Cover</span>
      )}
    </div>
  );
}

export function ComicGridView({
  comics,
  selectedId,
  onSelect,
  onToggleBookmark,
  bookmarkedIds,
  isLoading = false,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: ComicGridViewProps) {
  const { t } = useI18n();
  const sentinelRef = useInfiniteScroll({
    hasMore: Boolean(onLoadMore) && hasMore,
    isLoading: isLoading || isLoadingMore,
    onLoadMore: () => onLoadMore?.(),
  });

  if (isLoading) {
    return <ComicGridSkeleton count={10} />;
  }

  if (comics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8">
        <p className="text-[var(--text-primary)] text-sm font-medium mb-1 font-jakarta">
          {t.search.noResultsTitle}
        </p>
        <p className="text-[var(--text-muted)] text-xs font-mono-data">
          {t.search.noResultsDesc}
        </p>
      </div>
    );
  }

  return (
    <>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5">
      {comics.map((comic) => {
        const isSelected = selectedId === comic.id;
        const isBookmarked = bookmarkedIds.has(comic.id);
        const typeVariant =
          comic.type === 'MANHWA' ? 'manhwa' : comic.type === 'MANGA' ? 'manga' : 'manhua';

        return (
          <div
            key={comic.id}
            onClick={() => onSelect(comic)}
            className={cn(
              'group relative flex flex-col rounded-xl overflow-hidden bg-[var(--bg-surface)] border transition-all duration-150 cursor-pointer select-none shadow-xs',
              isSelected
                ? 'border-[#ff334b] ring-2 ring-[#ff334b]/40 shadow-md bg-[var(--bg-surface)]'
                : 'border-[var(--border-subtle)] hover:border-[var(--border-muted)] hover:bg-[var(--bg-surface-raised)]'
            )}
          >
            {/* Cover Image Container */}
            <div className="relative w-full aspect-[3/4] overflow-hidden bg-[var(--bg-surface-raised)]">
              <LazyCoverImage
                src={comic.cover_image_url}
                alt={comic.title_english || comic.title_romaji}
                className="group-hover:scale-[1.03]"
              />

              {/* Badges Over Cover */}
              <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
                <Badge variant={typeVariant}>{comic.type}</Badge>
                {comic.total_chapters ? (
                  <span className="px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md border border-white/20 text-white text-[10px] font-mono-data shadow-sm font-semibold">
                    {comic.total_chapters} ch
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md border border-emerald-500/40 text-emerald-400 text-[10px] font-mono-data shadow-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{comic.status === 'FINISHED' ? 'Tamat' : 'Ongoing'}</span>
                  </span>
                )}
              </div>

              {comic.average_score && (
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 border border-white/20 text-amber-300 text-[10px] font-mono-data backdrop-blur-md shadow-sm">
                  <Star className="w-2.5 h-2.5 fill-current" />
                  <span>{(comic.average_score / 10).toFixed(1)}</span>
                </div>
              )}

              {/* Bookmark Hover Action */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBookmark(comic.id);
                }}
                className={cn(
                  'absolute bottom-2 right-2 z-10 p-1.5 rounded-lg backdrop-blur-md border transition-all cursor-pointer shadow-sm',
                  isBookmarked
                    ? 'bg-[#ff334b] text-white border-[#ff334b]'
                    : 'bg-black/60 text-white border-white/20 hover:bg-black/80 opacity-0 group-hover:opacity-100'
                )}
                title={isBookmarked ? 'Remove bookmark' : 'Bookmark comic'}
              >
                <Bookmark className={cn('w-3.5 h-3.5', isBookmarked && 'fill-current')} />
              </button>
            </div>

            {/* Title & Info */}
            <div className="p-2.5 flex flex-col gap-1 flex-1 justify-between">
              <div>
                <h3 className="text-xs font-semibold text-[var(--text-primary)] line-clamp-1 group-hover:text-[#ff334b] transition-colors font-jakarta">
                  {comic.title_english || comic.title_romaji}
                </h3>
                {comic.genres && comic.genres.length > 0 && (
                  <p className="text-[10px] text-[var(--text-muted)] truncate font-jakarta">
                    {comic.genres.slice(0, 2).join(' • ')}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono-data pt-1 border-t border-[var(--border-subtle)]">
                <span>{comic.country_of_origin} • {comic.release_year || '-'}</span>
                <span className="font-semibold text-[var(--text-secondary)]">
                  {comic.total_chapters ? `${comic.total_chapters} ch` : (comic.status === 'FINISHED' ? 'Tamat' : 'Ongoing')}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>

      {onLoadMore && (
        <>
          {/* Prefetch trigger — sits below the last row, 600px before the fold. */}
          <div ref={sentinelRef} aria-hidden className="h-px w-full" />

          {isLoadingMore && (
            <div className="mt-3.5">
              <ComicGridSkeleton count={5} />
            </div>
          )}

          {!hasMore && !isLoadingMore && (
            <p className="py-8 text-center text-[11px] font-mono-data text-[var(--text-muted)]">
              {t.common.endOfResults}
            </p>
          )}
        </>
      )}
    </>
  );
}
