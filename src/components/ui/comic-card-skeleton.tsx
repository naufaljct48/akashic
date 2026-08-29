export function ComicCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs">
      {/* 3:4 Cover Shimmer */}
      <div className="w-full aspect-[3/4] shimmer-element" />

      {/* Title & Metadata Lines */}
      <div className="p-2.5 flex flex-col gap-2">
        <div className="h-3.5 w-4/5 rounded shimmer-element" />
        <div className="h-2.5 w-1/2 rounded shimmer-element" />
        <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)]">
          <div className="h-2 w-8 rounded shimmer-element" />
          <div className="h-2 w-10 rounded shimmer-element" />
        </div>
      </div>
    </div>
  );
}

export function ComicGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5">
      {Array.from({ length: count }).map((_, i) => (
        <ComicCardSkeleton key={i} />
      ))}
    </div>
  );
}
