export function ComicInspectorSkeleton() {
  return (
    <aside className="w-full lg:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col h-full overflow-y-auto p-5 gap-5 shadow-lg animate-in fade-in duration-150">
      {/* Top badges shimmer */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <div className="h-5 w-16 rounded-md shimmer-element" />
          <div className="h-5 w-20 rounded-md shimmer-element" />
        </div>
        <div className="h-6 w-6 rounded-lg shimmer-element" />
      </div>

      {/* Cover & Title block shimmer */}
      <div className="flex gap-4">
        <div className="w-24 aspect-[3/4] rounded-xl shimmer-element shrink-0" />
        <div className="flex flex-col justify-between flex-1 py-1">
          <div className="flex flex-col gap-2">
            <div className="h-4 w-full rounded shimmer-element" />
            <div className="h-3 w-3/4 rounded shimmer-element" />
          </div>
          <div className="h-7 w-full rounded-lg shimmer-element mt-3" />
        </div>
      </div>

      {/* 3 Metric cards shimmer */}
      <div className="grid grid-cols-3 gap-2">
        <div className="h-12 rounded-lg shimmer-element" />
        <div className="h-12 rounded-lg shimmer-element" />
        <div className="h-12 rounded-lg shimmer-element" />
      </div>

      {/* Synopsis shimmer lines */}
      <div className="flex flex-col gap-2 pt-2">
        <div className="h-3 w-20 rounded shimmer-element" />
        <div className="h-2.5 w-full rounded shimmer-element" />
        <div className="h-2.5 w-full rounded shimmer-element" />
        <div className="h-2.5 w-4/5 rounded shimmer-element" />
        <div className="h-2.5 w-2/3 rounded shimmer-element" />
      </div>

      {/* Recommendations shimmer list */}
      <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border-subtle)]">
        <div className="h-3 w-40 rounded shimmer-element" />
        <div className="h-10 w-full rounded-lg shimmer-element" />
        <div className="h-10 w-full rounded-lg shimmer-element" />
        <div className="h-10 w-full rounded-lg shimmer-element" />
      </div>
    </aside>
  );
}
