import { useEffect, useRef, useState } from 'react';
import { track } from '@vercel/analytics';
import { getComicBySlug, findComicByTitle } from '@/services/comic.service';
import type { ComicSearchResult } from '@/core/types/comic';

/**
 * Module scope on purpose. The open title follows you across tabs and each tab
 * runs its own copy of this hook, so a per-instance guard would count one switch
 * as a second inspect of the same comic.
 */
let lastTrackedSlug: string | null = null;

/**
 * Two-way binding between whichever comic the inspector has open and `?c=<slug>`.
 *
 * Each tab keeps its own `selectedComic`, so a deep link implemented inside one
 * view only ever worked in that view — a catalog or bookmarks link opened the
 * app on an empty inspector. The URL is this app's only shareable surface (there
 * is no router), so the read/write pair lives here once instead of three times.
 *
 * `pendingSlug` is returned so a view whose feed auto-selects its first card can
 * hold off while a link is still resolving, rather than stealing the inspector
 * from the title the link was actually about.
 */
export function useComicDeepLink(
  selected: ComicSearchResult | null,
  onResolve: (comic: ComicSearchResult) => void
): { pendingSlug: string | null } {
  // Read once, lazily. Reading on every render would pick up what the writer
  // effect below just wrote and feed the hook its own output.
  const [pendingSlug] = useState(() =>
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('c')
  );

  // The writer must not run before the link has resolved, or it deletes the
  // very param it is about to read.
  const ready = useRef(false);

  // Held in a ref so an inline arrow from the caller does not re-run the
  // resolve effect on every render.
  const onResolveRef = useRef(onResolve);
  onResolveRef.current = onResolve;

  useEffect(() => {
    if (!pendingSlug) {
      ready.current = true;
      return;
    }

    let cancelled = false;
    (async () => {
      // getComicBySlug covers the catalog; findComicByTitle falls through to
      // AniList, which is how a link to a live-only title still opens for the
      // person it was sent to.
      const found =
        (await getComicBySlug(pendingSlug)) ??
        (await findComicByTitle(pendingSlug.replace(/-/g, ' ')));
      if (cancelled) return;
      if (found) onResolveRef.current(found as ComicSearchResult);
      ready.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingSlug]);

  // replaceState, not pushState: opening cards is browsing, not navigation, and
  // filling the back stack with inspector opens makes Back useless.
  useEffect(() => {
    if (!ready.current) return;
    const url = new URL(window.location.href);
    if (selected?.slug) url.searchParams.set('c', selected.slug);
    else url.searchParams.delete('c');
    window.history.replaceState(null, '', url);
  }, [selected]);

  // The consequence of replaceState is that Vercel's script, which only hooks
  // pushState, never sees any of this — every session would register as a single
  // page view no matter how many titles were opened. One custom event per title
  // records what people actually look at, without touching history.
  useEffect(() => {
    const slug = selected?.slug;
    if (!slug || slug === lastTrackedSlug) return;
    lastTrackedSlug = slug;
    track('inspect', { slug });
  }, [selected]);

  return { pendingSlug };
}
