export function ExperimentsListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-surface border border-border rounded-lg p-5 animate-pulse">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="h-5 bg-bg rounded w-40 mb-2" />
              <div className="h-3 bg-bg rounded w-24" />
            </div>
            <div className="h-6 bg-bg rounded w-20" />
          </div>
          <div className="flex gap-6">
            <div className="h-3 bg-bg rounded w-16" />
            <div className="h-3 bg-bg rounded w-16" />
            <div className="h-3 bg-bg rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}
