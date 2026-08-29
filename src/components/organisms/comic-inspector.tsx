import { useState, useEffect, useRef } from 'react';
import {
  X,
  Bookmark,
  ExternalLink,
  Star,
  Radio,
  ThumbsUp,
  Network,
  BookOpen,
  ChevronDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

function InspectorCoverImage({
  src,
  alt,
}: {
  src: string;
  alt: string;
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
    <div className="relative w-24 aspect-[3/4] rounded-xl overflow-hidden bg-[var(--bg-surface-raised)] shrink-0 border border-[var(--border-subtle)] shadow-md flex items-center justify-center">
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
      {hasError && (
        <span className="text-[10px] font-mono-data text-[var(--text-muted)] text-center px-1">
          No Cover
        </span>
      )}
    </div>
  );
}

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

  return (
    <>
      {/* Mobile Backdrop Overlay (< lg) */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs lg:hidden animate-in fade-in duration-150"
      />

      <aside className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] rounded-t-3xl border-t border-[var(--border-muted)] lg:static lg:inset-auto lg:z-auto lg:w-[380px] lg:my-5 lg:mr-5 lg:h-[calc(100%-2.5rem)] lg:max-h-none lg:rounded-2xl lg:border lg:border-[var(--border-subtle)] lg:shadow-xl bg-[var(--bg-surface)] flex flex-col h-auto overflow-y-auto p-4 sm:p-5 gap-4 sm:gap-5 shadow-2xl animate-in slide-in-from-bottom-10 lg:slide-in-from-right duration-200">
        {/* Mobile Pull Handle Pill */}
        <div className="w-10 h-1 rounded-full bg-[var(--border-muted)] mx-auto -mt-1 mb-1 lg:hidden shrink-0" />

        {/* Top Bar: Format badge & Close button */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Badge variant={typeVariant}>{comic.type}</Badge>
            <Badge variant="status">{liveStatus}</Badge>
            {isLiveSynced && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 font-mono-data">
                <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                <span>LIVE</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer"
            title={t.inspector.closeInspector}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      {/* Cover & Title Block */}
      <div className="flex gap-4">
        {(liveCover || comic.cover_image_url) && (
          <InspectorCoverImage
            src={liveCover || comic.cover_image_url || ''}
            alt={comic.title_english || comic.title_romaji}
          />
        )}

        <div className="flex flex-col justify-between flex-1 min-w-0">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)] leading-snug line-clamp-2 font-jakarta">
              {comic.title_english || comic.title_romaji}
            </h2>
            {comic.title_romaji && comic.title_english && (
              <p className="text-xs text-[var(--text-muted)] truncate mt-0.5 font-jakarta">{comic.title_romaji}</p>
            )}
            {comic.title_native && (
              <p className="text-xs text-[var(--text-muted)] font-mono-data mt-0.5">{comic.title_native}</p>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2">
            <Button
              variant={isBookmarked ? 'crimson' : 'secondary'}
              size="sm"
              onClick={() => onToggleBookmark(comic.id)}
              className="w-full text-xs font-jakarta"
            >
              <Bookmark className={cn('w-3.5 h-3.5', isBookmarked && 'fill-current')} />
              <span>{isBookmarked ? t.common.bookmarked : t.common.save}</span>
            </Button>

            {comic.site_url && (
              <a
                href={comic.site_url}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors shrink-0"
                title={t.inspector.openAniList}
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Reading Status Tracker (if bookmarked) */}
      {isBookmarked && (
        <div className="p-3 rounded-xl bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] flex flex-col gap-2 font-mono-data text-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-[#ff334b]" />
              {t.inspector.readingStatus}
            </span>
            <select
              value={bookmarkItem?.status || 'PLAN_TO_READ'}
              onChange={(e) =>
                onUpdateBookmarkStatus?.(
                  comic.id,
                  e.target.value as ReadingStatus,
                  bookmarkItem?.progressChapter
                )
              }
              className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded px-2 py-0.5 text-[11px] focus:outline-none focus:border-[#ff334b] cursor-pointer"
            >
              <option value="PLAN_TO_READ">{t.inspector.planToRead}</option>
              <option value="READING">{t.inspector.reading}</option>
              <option value="COMPLETED">{t.inspector.completed}</option>
            </select>
          </div>

          {bookmarkItem?.status === 'READING' && (
            <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-[11px]">
              <span className="text-[var(--text-muted)]">{t.inspector.currentProgress}:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[var(--text-muted)]">Ch.</span>
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
                  className="w-14 px-1.5 py-0.5 rounded bg-[var(--input-bg)] border border-[var(--border-subtle)] text-center text-xs text-[var(--text-primary)] font-bold focus:outline-none focus:border-[#ff334b]"
                />
                <span className="text-[var(--text-muted)]">
                  / {comic.total_chapters ? `${comic.total_chapters} ch` : '∞'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Metadata Grid */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono-data">
        <div className="p-2 rounded-lg bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] flex flex-col">
          <span className="text-[10px] text-[var(--text-muted)] uppercase font-sans">{t.inspector.rating}</span>
          <span className="text-amber-500 font-semibold mt-0.5 flex items-center justify-center gap-1">
            <Star className="w-3 h-3 fill-current" />
            {liveScore ? (liveScore / 10).toFixed(1) : 'N/A'}
          </span>
        </div>

        <div className="p-2 rounded-lg bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] flex flex-col">
          <span className="text-[10px] text-[var(--text-muted)] uppercase font-sans">{t.inspector.chapters}</span>
          <span className="text-[var(--text-primary)] font-semibold mt-0.5">
            {liveChapters ? `${liveChapters} ch` : t.common.ongoing}
          </span>
        </div>

        <div className="p-2 rounded-lg bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] flex flex-col">
          <span className="text-[10px] text-[var(--text-muted)] uppercase font-sans">{t.inspector.origin}</span>
          <span className="text-[var(--text-primary)] font-semibold mt-0.5">
            {comic.country_of_origin} • {comic.release_year || '-'}
          </span>
        </div>
      </div>

      {/* AI Match Rationale (if present) */}
      {comic.matchReason && (
        <div className="p-3 rounded-xl bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs flex flex-col gap-1 leading-relaxed">
          <span className="text-[11px] font-semibold text-[#ff334b] uppercase tracking-wider font-mono-data">
            {t.inspector.matchRationale}
          </span>
          <p className="text-[var(--text-primary)] font-jakarta">{comic.matchReason}</p>
        </div>
      )}

      {/* Synopsis */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono-data">
          {t.inspector.synopsis}
        </span>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-h-56 overflow-y-auto pr-1 font-jakarta">
          {comic.synopsis || t.inspector.noSynopsis}
        </p>
      </div>

      {/* Zero-Token Community Recommendations (Instant 1-Click Select) */}
      {graphData && graphData.recommendations.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <div className="flex items-center justify-between font-mono-data text-xs">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
              <ThumbsUp className="w-3 h-3 text-amber-400" />
              {t.inspector.communityRecs}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--text-muted)] font-mono-data">
                {Math.min(recsShown, graphData.recommendations.length)}/
                {graphData.recommendations.length}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--bg-surface-raised)] border border-[var(--border-subtle)] text-zinc-400 font-bold">
                {t.inspector.zeroToken}
              </span>
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {graphData.recommendations.slice(0, recsShown).map((rec) => (
              <div
                key={rec.id}
                onClick={() => onSelectRelatedTitle?.(rec.title)}
                className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] hover:border-[var(--border-muted)] transition-colors cursor-pointer group select-none"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {rec.coverImage ? (
                    <img
                      src={rec.coverImage}
                      alt={rec.title}
                      className="w-7 h-9 object-cover rounded shrink-0 bg-zinc-900"
                    />
                  ) : (
                    <div className="w-7 h-9 rounded bg-zinc-800 shrink-0" />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[#ff334b] transition-colors truncate font-jakarta">
                      {rec.title}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono-data">
                      [{rec.type}] {rec.averageScore ? `★ ${(rec.averageScore / 10).toFixed(1)}` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[10px] text-amber-500 font-mono-data font-semibold shrink-0 ml-2">
                  <span>+{rec.votes}</span>
                </div>
              </div>
            ))}
          </div>

          {graphData.recommendations.length > recsShown && (
            <button
              type="button"
              onClick={() =>
                setRecsShown((n) => Math.min(n + RECS_PAGE_SIZE, graphData.recommendations.length))
              }
              className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[11px] font-mono-data text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <ChevronDown className="w-3 h-3" />
              {t.inspector.showMore(graphData.recommendations.length - recsShown)}
            </button>
          )}

          {recsShown > RECS_PAGE_SIZE && (
            <button
              type="button"
              onClick={() => setRecsShown(RECS_PAGE_SIZE)}
              className="text-[10px] font-mono-data text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer underline self-center"
            >
              {t.inspector.showLess}
            </button>
          )}
        </div>
      )}

      {/* Related Franchises (Prequel / Sequel / Spin-off) */}
      {graphData && graphData.relations.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--border-subtle)]">
          <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono-data flex items-center gap-1.5">
            <Network className="w-3 h-3 text-[#ff334b]" />
            {t.inspector.relations}
          </span>
          <div className="flex flex-wrap gap-1">
            {graphData.relations.slice(0, relationsShown).map((rel, idx) => (
              <span
                key={idx}
                onClick={() => onSelectRelatedTitle?.(rel.title)}
                className="text-[11px] px-2 py-1 rounded bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-muted)] cursor-pointer font-jakarta flex items-center gap-1 transition-colors select-none"
                title={`${rel.relationType}: ${rel.title}`}
              >
                <strong className="text-[9px] text-[#ff334b] uppercase font-mono-data">
                  {rel.relationType}
                </strong>
                <span className="truncate max-w-[140px]">{rel.title}</span>
              </span>
            ))}

            {graphData.relations.length > relationsShown && (
              <button
                type="button"
                onClick={() =>
                  setRelationsShown((n) =>
                    Math.min(n + RELATIONS_PAGE_SIZE, graphData.relations.length)
                  )
                }
                className="text-[11px] px-2 py-1 rounded bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] cursor-pointer font-mono-data transition-colors"
              >
                +{graphData.relations.length - relationsShown}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tropes & Tags */}
      {comic.tags && comic.tags.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--border-subtle)]">
          <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono-data">
            {t.inspector.tropes}
          </span>
          <div className="flex flex-wrap gap-1">
            {comic.tags.map((tTag) => (
              <span
                key={tTag}
                className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-surface-raised)] text-[var(--text-secondary)] border border-[var(--border-subtle)] font-jakarta"
              >
                #{tTag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Genres */}
      {comic.genres && comic.genres.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono-data">
            {t.inspector.genres}
          </span>
          <div className="flex flex-wrap gap-1">
            {comic.genres.map((g) => (
              <span
                key={g}
                className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-surface-raised)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-jakarta"
              >
                {g}
              </span>
            ))}
          </div>
        </div>
      )}
    </aside>
    </>
  );
}
