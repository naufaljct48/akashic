import { useState, useEffect, useRef } from 'react';
import { Bookmark, Star } from 'lucide-react';
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

/**
 * Every entry carries a line saying what it is.
 *
 * The AI's own match reason when there is one; otherwise the opening of the
 * title's synopsis, which is the title's own words rather than anything
 * invented for it. AniList ships synopses with markup in them, so the tags come
 * out before the sentence does.
 */
function entryBlurb(comic: ComicSearchResult): string | null {
  if (comic.matchReason) return comic.matchReason;
  if (!comic.synopsis) return null;
  const plain = comic.synopsis
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return null;
  return plain.length > 120 ? `${plain.slice(0, 117).trimEnd()}…` : plain;
}

function LazyCoverImage({ src, alt, label }: { src: string | null; alt: string; label: string }) {
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
      <div className="stamp w-full h-full flex items-center justify-center text-[9px] text-[var(--ink-faint)] bg-[var(--paper-plate)]">
        {label}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-[var(--paper-plate)] overflow-hidden">
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
          'w-full h-full object-cover transition-opacity duration-300 ease-out',
          loaded && !hasError ? 'opacity-100' : 'opacity-0'
        )}
      />
      {hasError && (
        <span className="stamp absolute inset-0 flex items-center justify-center text-[9px] text-[var(--ink-faint)]">
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * The plate gallery.
 *
 * Covers are this catalog's real content, so they are what the page is made of:
 * mounted plates on the sheet, each with a hairline keyline, nothing between
 * them but paper. No card shell, no panel behind the artwork, and no rank
 * numeral in the margin — the reader is looking at an issue's plates, not
 * reading a running order down a column.
 *
 * Column count follows the container, not the viewport: the catalog runs this
 * same grid inside a column a filter rail narrower than discovery's.
 */
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
      <div className="py-16 px-6 text-center border-y-2 border-[var(--ink)]">
        <p className="masthead text-2xl text-[var(--ink)] mb-2">{t.search.noResultsTitle}</p>
        <p className="text-sm text-[var(--ink-soft)] max-w-md mx-auto leading-relaxed">
          {t.search.noResultsDesc}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="@container/plates">
        <ul className="grid grid-cols-2 @[34rem]/plates:grid-cols-3 @[48rem]/plates:grid-cols-4 @[64rem]/plates:grid-cols-5 gap-x-5 gap-y-7">
          {comics.map((comic, index) => {
            const isSelected = selectedId === comic.id;
            const isBookmarked = bookmarkedIds.has(comic.id);
            const title = comic.title_english || comic.title_romaji;
            const blurb = entryBlurb(comic);

            return (
              <li
                key={comic.id}
                className="ink-strike"
                style={{ animationDelay: `${Math.min(index, 14) * 28}ms` }}
              >
                <article
                  onClick={() => onSelect(comic)}
                  className="group flex flex-col h-full cursor-pointer select-none"
                >
                  {/* The plate, keylined the way a mounted plate is. */}
                  <div
                    className={cn(
                      'relative w-full aspect-[3/4] overflow-hidden bg-[var(--paper-plate)]',
                      'outline -outline-offset-1 transition-[outline-color,outline-width]',
                      isSelected
                        ? 'outline-2 outline-[var(--spot)]'
                        : 'outline-1 outline-[var(--rule)] group-hover:outline-[var(--ink)]'
                    )}
                  >
                    <LazyCoverImage src={comic.cover_image_url} alt={title} label={t.press.noPlate} />

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleBookmark(comic.id);
                      }}
                      className={cn(
                        'absolute top-0 right-0 z-10 p-1.5 transition-opacity cursor-pointer',
                        isBookmarked
                          ? 'bg-[var(--spot)] text-[var(--on-spot)] opacity-100'
                          : 'bg-[var(--paper-sheet)] text-[var(--ink)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100'
                      )}
                      title={isBookmarked ? t.common.bookmarked : t.common.save}
                      aria-label={isBookmarked ? t.common.bookmarked : t.common.save}
                    >
                      <Bookmark className={cn('w-3.5 h-3.5', isBookmarked && 'fill-current')} />
                    </button>
                  </div>

                  <h3
                    className={cn(
                      'text-[13px] font-semibold leading-tight line-clamp-2 mt-2 transition-colors',
                      isSelected
                        ? 'text-[var(--spot-text)]'
                        : 'text-[var(--ink)] group-hover:text-[var(--spot-text)]'
                    )}
                  >
                    {title}
                  </h3>

                  {/* The editor's line: why this title, in one sentence. */}
                  {blurb && (
                    <p className="text-[11px] text-[var(--ink-soft)] leading-snug line-clamp-2 mt-1">
                      {comic.matchReason && (
                        <span className="stamp text-[9px] text-[var(--spot-text)] mr-1">
                          {t.press.why}
                        </span>
                      )}
                      {blurb}
                    </p>
                  )}

                  {/* Credit line, on the hairline that closes the entry. */}
                  <p className="stamp figures flex items-center justify-between gap-2 mt-auto pt-1.5 border-t border-[var(--rule)] text-[9px] text-[var(--ink-faint)]">
                    <span className="text-[var(--ink-soft)] truncate">{comic.type}</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {comic.average_score && (
                        <span className="flex items-center gap-0.5 text-[var(--ink-gold)]">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          {(comic.average_score / 10).toFixed(1)}
                        </span>
                      )}
                      <span>
                        {comic.total_chapters
                          ? `${comic.total_chapters} ch`
                          : comic.status === 'FINISHED'
                            ? t.common.finished
                            : t.common.ongoing}
                      </span>
                    </span>
                  </p>
                </article>
              </li>
            );
          })}
        </ul>
      </div>

      {onLoadMore && (
        <>
          {/* Prefetch trigger — sits below the last row, 600px before the fold. */}
          <div ref={sentinelRef} aria-hidden className="h-px w-full" />

          {isLoadingMore && (
            <div className="mt-7">
              <ComicGridSkeleton count={5} />
            </div>
          )}

          {!hasMore && !isLoadingMore && (
            <p className="stamp py-10 text-center text-[10px] text-[var(--ink-faint)]">
              — {t.common.endOfResults} —
            </p>
          )}
        </>
      )}
    </>
  );
}
