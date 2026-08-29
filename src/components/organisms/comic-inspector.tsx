import { useState, useEffect, useRef } from 'react';
import { X, Bookmark, ExternalLink, Star, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PrintedSelect } from '@/components/molecules/printed-select';
import { useI18n } from '@/core/i18n/context';
import { syncLiveComicData, fetchFreshCoverFromAniList } from '@/services/anilist-live.service';
import { getComicGraphData, type ComicGraphData } from '@/services/recommendation-graph.service';
import type { BookmarkItem, ReadingStatus } from '@/core/types/bookmark';
import type { ComicSearchResult } from '@/core/types/comic';
import { cn } from '@/lib/utils/cn';

const RECS_PAGE_SIZE = 6;
const RELATIONS_PAGE_SIZE = 6;

interface ComicInspectorProps {
  comic: ComicSearchResult | null;
  onClose: () => void;
  onToggleBookmark: (id: string) => void;
  isBookmarked: boolean;
  bookmarkItem?: BookmarkItem | null;
  onUpdateBookmarkStatus?: (id: string, status: ReadingStatus, progress?: number) => void;
  onSelectRelatedTitle?: (title: string) => void;
}

/** A section head in the spread: name, hairline, content. No boxes. */
function Head({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="stamp text-[9px] text-[var(--ink-faint)] pb-1.5 mb-2.5 border-b border-[var(--rule)]">
      {children}
    </h3>
  );
}

function InspectorCoverImage({ src, alt, label }: { src: string; alt: string; label: string }) {
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
    // Auto-heal by searching fresh cover from AniList GraphQL
    const fresh = await fetchFreshCoverFromAniList(alt);
    if (fresh && fresh !== currentSrc) {
      setCurrentSrc(fresh);
      setHasError(false);
    } else {
      setLoaded(true);
    }
  };

  return (
    <div className="relative w-28 aspect-[3/4] overflow-hidden bg-[var(--paper-plate)] shrink-0 outline outline-1 -outline-offset-1 outline-[var(--rule)] flex items-center justify-center">
      {!loaded && !hasError && <div className="absolute inset-0 shimmer-element" />}
      <img
        ref={imgRef}
        key={currentSrc}
        src={currentSrc}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={handleError}
        className={cn(
          'w-full h-full object-cover transition-opacity duration-200',
          loaded && !hasError ? 'opacity-100' : 'opacity-0'
        )}
      />
      {hasError && <span className="stamp text-[9px] text-[var(--ink-faint)]">{label}</span>}
    </div>
  );
}

/**
 * The entry's own spread.
 *
 * Inherits `--spot` from whichever view opened it, so the panel prints in that
 * department's ink without being told. Data sits in a ruled column set the way
 * a periodical prints its specification block — never as three metric tiles.
 */
export function ComicInspector({
  comic,
  onClose,
  onToggleBookmark,
  isBookmarked,
  bookmarkItem,
  onUpdateBookmarkStatus,
  onSelectRelatedTitle,
}: ComicInspectorProps) {
  const { t } = useI18n();
  const [liveChapters, setLiveChapters] = useState<number | null>(comic?.total_chapters || null);
  const [liveStatus, setLiveStatus] = useState<string>(comic?.status || 'RELEASING');
  const [liveScore, setLiveScore] = useState<number | null>(comic?.average_score || null);
  const [liveCover, setLiveCover] = useState<string | null>(comic?.cover_image_url || null);
  const [isLiveSynced, setIsLiveSynced] = useState<boolean>(false);
  const [graphData, setGraphData] = useState<ComicGraphData | null>(null);

  // AniList returns up to 25 community recs; showing all of them buries the
  // tropes and genres below. Reveal in pages instead of a hard slice(0, 5).
  const [recsShown, setRecsShown] = useState(RECS_PAGE_SIZE);
  const [relationsShown, setRelationsShown] = useState(RELATIONS_PAGE_SIZE);

  useEffect(() => {
    if (!comic) return;
    setLiveChapters(comic.total_chapters);
    setLiveStatus(comic.status);
    setLiveScore(comic.average_score);
    setLiveCover(comic.cover_image_url);
    setIsLiveSynced(false);
    setRecsShown(RECS_PAGE_SIZE);
    setRelationsShown(RELATIONS_PAGE_SIZE);

    // 1. Trigger on-demand live AniList sync
    syncLiveComicData(comic).then((res) => {
      if (res.updated) {
        setLiveChapters(res.chapters);
        setLiveStatus(res.status);
        setLiveScore(res.averageScore);
        if (res.coverImageUrl) {
          setLiveCover(res.coverImageUrl);
        }
        setIsLiveSynced(true);
      }
    });

    // 2. Fetch Zero-Token Community Recommendations & Relations
    getComicGraphData(comic.source_id).then((g) => {
      setGraphData(g);
    });
  }, [comic?.id]);

  if (!comic) return null;

  const typeVariant =
    comic.type === 'MANHWA' ? 'manhwa' : comic.type === 'MANGA' ? 'manga' : 'manhua';
  const title = comic.title_english || comic.title_romaji;

  return (
    <>
      {/* Mobile Backdrop Overlay (< lg) */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-[color-mix(in_oklab,var(--ink)_70%,transparent)] lg:hidden animate-in fade-in duration-150"
      />

      <aside className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] border-t-2 border-[var(--ink)] lg:static lg:inset-auto lg:z-auto lg:w-[400px] lg:h-full lg:max-h-none lg:border-t-0 lg:border-l lg:border-[var(--rule)] bg-[var(--paper-sheet)] flex flex-col overflow-y-auto shadow-[var(--lift-shadow)] lg:shadow-none animate-in slide-in-from-bottom-10 lg:slide-in-from-right duration-200">
        {/* Sticky top rail */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-2 bg-[var(--ink)] text-[var(--paper)]">
          <div className="flex items-center gap-2 min-w-0">
            {isLiveSynced ? (
              <span className="stamp flex items-center gap-1.5 text-[9px] opacity-90">
                <span className="ink-pulse w-1.5 h-1.5 bg-[var(--paper)]" aria-hidden />
                {t.feeds.liveBadge}
              </span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[var(--paper)] opacity-70 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
            title={t.inspector.closeInspector}
            aria-label={t.inspector.closeInspector}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-4 flex flex-col gap-5">
          {/* The title block */}
          <div className="flex gap-4">
            {(liveCover || comic.cover_image_url) && (
              <InspectorCoverImage src={liveCover || comic.cover_image_url || ''} alt={title} label={t.press.noPlate} />
            )}

            <div className="flex flex-col min-w-0 flex-1">
              <h2 className="masthead text-[clamp(1.15rem,4.5vw,1.55rem)] leading-[1.05] text-[var(--ink)] line-clamp-3">
                {title}
              </h2>
              {comic.title_romaji && comic.title_english && (
                <p className="text-[11px] text-[var(--ink-faint)] truncate mt-1.5">
                  {comic.title_romaji}
                </p>
              )}
              {comic.title_native && (
                <p className="text-[11px] text-[var(--ink-faint)] truncate">{comic.title_native}</p>
              )}

              <div className="flex items-center gap-1.5 mt-auto pt-3">
                <button
                  type="button"
                  onClick={() => onToggleBookmark(comic.id)}
                  className={cn(
                    'stamp flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] border transition-colors cursor-pointer active:translate-y-px',
                    isBookmarked
                      ? 'bg-[var(--spot)] text-[var(--on-spot)] border-[var(--spot)]'
                      : 'bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)] hover:bg-[var(--ink-soft)]'
                  )}
                >
                  <Bookmark className={cn('w-3.5 h-3.5', isBookmarked && 'fill-current')} />
                  <span>{isBookmarked ? t.common.bookmarked : t.common.save}</span>
                </button>

                {comic.site_url && (
                  <a
                    href={comic.site_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 border border-[var(--rule)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--ink)] transition-colors shrink-0"
                    title={t.inspector.openAniList}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* The specification block, set as a ruled table. */}
          <dl className="border-t-2 border-[var(--ink)]">
            {[
              {
                label: t.inspector.rating,
                value: liveScore ? (liveScore / 10).toFixed(1) : '—',
                star: Boolean(liveScore),
              },
              {
                label: t.inspector.chapters,
                value: liveChapters ? `${liveChapters}` : t.common.ongoing,
              },
              { label: t.catalog.status, value: liveStatus },
              {
                label: t.inspector.origin,
                value: [comic.country_of_origin, comic.release_year].filter(Boolean).join(' · ') || '—',
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-3 py-1.5 border-b border-[var(--rule)]"
              >
                <dt className="stamp text-[9px] text-[var(--ink-faint)]">{row.label}</dt>
                <dd className="figures flex items-center gap-1 text-sm font-semibold text-[var(--ink)]">
                  {row.star && <Star className="w-3 h-3 fill-current text-[var(--ink-gold)]" />}
                  <span className="truncate">{row.value}</span>
                </dd>
              </div>
            ))}
          </dl>

          {/* Reading status — the reader's own marginal note */}
          {isBookmarked && (
            <section>
              <Head>{t.inspector.readingStatus}</Head>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-[var(--ink-soft)]">{t.inspector.readingStatus}</span>
                <PrintedSelect
                  label={t.inspector.readingStatus}
                  value={(bookmarkItem?.status || 'PLAN_TO_READ') as ReadingStatus}
                  onChange={(status) =>
                    onUpdateBookmarkStatus?.(comic.id, status, bookmarkItem?.progressChapter)
                  }
                  options={[
                    { value: 'PLAN_TO_READ' as const, label: t.inspector.planToRead },
                    { value: 'READING' as const, label: t.inspector.reading },
                    { value: 'COMPLETED' as const, label: t.inspector.completed },
                  ]}
                  className="min-w-[8rem]"
                />
              </div>

              {bookmarkItem?.status === 'READING' && (
                <label className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-[var(--rule)]">
                  <span className="text-xs text-[var(--ink-soft)]">{t.inspector.currentProgress}</span>
                  <span className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      max={comic.total_chapters || 9999}
                      value={bookmarkItem?.progressChapter !== undefined ? bookmarkItem.progressChapter : 0}
                      onChange={(e) => {
                        const parsed = parseInt(e.target.value, 10);
                        onUpdateBookmarkStatus?.(
                          comic.id,
                          'READING',
                          isNaN(parsed) ? 0 : Math.max(0, parsed)
                        );
                      }}
                      className="figures w-16 px-2 py-1 bg-[var(--paper)] border border-[var(--rule)] focus:border-[var(--spot)] text-center text-xs font-semibold text-[var(--ink)] focus:outline-none transition-colors"
                    />
                    <span className="stamp figures text-[9px] text-[var(--ink-faint)]">
                      / {comic.total_chapters || '∞'}
                    </span>
                  </span>
                </label>
              )}
            </section>
          )}

          {/* The editor's note */}
          {comic.matchReason && (
            <section className="border-t-[3px] border-[var(--spot)] pt-2.5">
              <p className="stamp text-[9px] text-[var(--spot-text)] mb-1.5">
                {t.inspector.matchRationale}
              </p>
              <p className="text-[14px] text-[var(--ink)] leading-relaxed">{comic.matchReason}</p>
            </section>
          )}

          {/* Synopsis */}
          <section>
            <Head>{t.inspector.synopsis}</Head>
            <p className="text-[13px] text-[var(--ink-soft)] leading-relaxed">
              {comic.synopsis || t.inspector.noSynopsis}
            </p>
          </section>

          {/* Reader recommendations */}
          {graphData && graphData.recommendations.length > 0 && (
            <section>
              <Head>
                {t.inspector.communityRecs} ·{' '}
                {Math.min(recsShown, graphData.recommendations.length)}/
                {graphData.recommendations.length}
              </Head>

              <ul className="flex flex-col">
                {graphData.recommendations.slice(0, recsShown).map((rec) => (
                  <li key={rec.id}>
                    <button
                      type="button"
                      onClick={() => onSelectRelatedTitle?.(rec.title)}
                      className="group w-full flex items-center justify-between gap-2.5 py-2 border-b border-[var(--rule)] text-left cursor-pointer transition-colors hover:bg-[var(--paper-deep)]"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        {rec.coverImage ? (
                          <img
                            src={rec.coverImage}
                            alt=""
                            className="w-8 aspect-[3/4] object-cover shrink-0 bg-[var(--paper-plate)]"
                          />
                        ) : (
                          <span className="w-8 aspect-[3/4] bg-[var(--paper-plate)] shrink-0" />
                        )}
                        <span className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-[var(--ink)] group-hover:text-[var(--spot-text)] transition-colors truncate">
                            {rec.title}
                          </span>
                          <span className="stamp figures text-[9px] text-[var(--ink-faint)] mt-0.5">
                            {rec.type}
                            {rec.averageScore ? ` · ★ ${(rec.averageScore / 10).toFixed(1)}` : ''}
                          </span>
                        </span>
                      </span>
                      <span className="stamp figures text-[9px] text-[var(--spot-text)] shrink-0">
                        +{rec.votes}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-3 mt-2">
                {graphData.recommendations.length > recsShown && (
                  <button
                    type="button"
                    onClick={() =>
                      setRecsShown((n) =>
                        Math.min(n + RECS_PAGE_SIZE, graphData.recommendations.length)
                      )
                    }
                    className="stamp flex items-center gap-1 text-[9px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                  >
                    <ChevronDown className="w-3 h-3" />
                    {t.inspector.showMore(graphData.recommendations.length - recsShown)}
                  </button>
                )}
                {recsShown > RECS_PAGE_SIZE && (
                  <button
                    type="button"
                    onClick={() => setRecsShown(RECS_PAGE_SIZE)}
                    className="stamp text-[9px] text-[var(--ink-faint)] hover:text-[var(--ink)] underline transition-colors cursor-pointer"
                  >
                    {t.inspector.showLess}
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Related titles */}
          {graphData && graphData.relations.length > 0 && (
            <section>
              <Head>{t.inspector.relations}</Head>
              <div className="flex flex-wrap gap-1">
                {graphData.relations.slice(0, relationsShown).map((rel, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelectRelatedTitle?.(rel.title)}
                    className="flex items-center gap-1.5 px-1.5 py-1 border border-[var(--rule)] hover:border-[var(--ink)] transition-colors cursor-pointer select-none"
                    title={`${rel.relationType}: ${rel.title}`}
                  >
                    <span className="stamp text-[9px] text-[var(--spot-text)]">
                      {rel.relationType}
                    </span>
                    <span className="text-[11px] text-[var(--ink)] truncate max-w-[140px]">
                      {rel.title}
                    </span>
                  </button>
                ))}

                {graphData.relations.length > relationsShown && (
                  <button
                    type="button"
                    onClick={() =>
                      setRelationsShown((n) =>
                        Math.min(n + RELATIONS_PAGE_SIZE, graphData.relations.length)
                      )
                    }
                    className="stamp figures px-2 py-1 text-[9px] border border-[var(--rule)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--ink)] transition-colors cursor-pointer"
                  >
                    +{graphData.relations.length - relationsShown}
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Tropes */}
          {comic.tags && comic.tags.length > 0 && (
            <section>
              <Head>{t.inspector.tropes}</Head>
              <div className="flex flex-wrap gap-1">
                {comic.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] px-1.5 py-0.5 border border-[var(--rule)] text-[var(--ink-soft)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Genres */}
          {comic.genres && comic.genres.length > 0 && (
            <section className="pb-2">
              <Head>{t.inspector.genres}</Head>
              <div className="flex flex-wrap gap-1">
                <Badge variant={typeVariant}>{comic.type}</Badge>
                {comic.genres.map((g) => (
                  <span
                    key={g}
                    className="text-[11px] px-1.5 py-0.5 border border-[var(--rule)] text-[var(--ink)]"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}
