export function SegmentsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-surface border border-border rounded-lg p-5 animate-pulse">
          <div className="h-5 bg-bg rounded w-3/4 mb-3"></div>
          <div className="h-4 bg-bg rounded w-1/2 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-bg rounded w-full"></div>
            <div className="h-3 bg-bg rounded w-2/3"></div>
          </div>
        </div>
      ))}
    </div>
  )
}
