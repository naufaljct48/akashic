import { useEffect, useRef } from 'react';

interface UseInfiniteScrollOptions {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  /** How far below the fold to start fetching. Big enough to hide the latency. */
  rootMargin?: string;
}

/**
 * Fires `onLoadMore` when the returned sentinel scrolls near the viewport.
 *
 * `root: null` is correct even though the grids live inside `overflow-y-auto`
 * panels: a sentinel scrolled out of its own scroll container is clipped, so it
 * stops intersecting the viewport too.
 */
export function useInfiniteScroll({
  hasMore,
  isLoading,
  onLoadMore,
  rootMargin = '600px',
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Keep the latest callback without re-creating the observer on every render.
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          onLoadMoreRef.current();
        }
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoading, rootMargin]);

  return sentinelRef;
}
