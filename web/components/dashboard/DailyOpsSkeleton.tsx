export function DailyOpsSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      <div className="h-6 w-48 rounded bg-muted" />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-3">
          <div className="h-24 rounded-xl bg-muted" />
          <div className="h-24 rounded-xl bg-muted" />
        </div>

        <div className="space-y-6 lg:col-span-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted" />
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-muted" />
            ))}
          </div>
        </div>

        <div className="space-y-3 lg:col-span-3">
          <div className="h-32 rounded-xl bg-muted" />
          <div className="h-32 rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  );
}
