/**
 * A plate waiting for ink. Matches the entry's real geometry — plate, title,
 * blurb, credit line under its hairline — so nothing shifts when the run lands.
 */
export function ComicCardSkeleton() {
  return (
    <li className="flex flex-col gap-2">
      <div className="w-full aspect-[3/4] shimmer-element" />
      <div className="flex flex-col gap-1.5">
        <div className="h-3 w-4/5 shimmer-element" />
        <div className="h-2.5 w-full shimmer-element" />
        <div className="h-2.5 w-2/3 shimmer-element" />
      </div>
      <div className="flex items-center justify-between pt-1.5 border-t border-[var(--rule)]">
        <div className="h-2 w-10 shimmer-element" />
        <div className="h-2 w-12 shimmer-element" />
      </div>
    </li>
  );
}

export function ComicGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="@container/plates">
      <ul className="grid grid-cols-2 @[34rem]/plates:grid-cols-3 @[48rem]/plates:grid-cols-4 @[64rem]/plates:grid-cols-5 gap-x-5 gap-y-7">
        {Array.from({ length: count }).map((_, i) => (
          <ComicCardSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
}
