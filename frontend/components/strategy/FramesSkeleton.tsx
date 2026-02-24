export function FramesSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2].map((segmentI) => (
        <div key={segmentI}>
          <div className="h-4 bg-bg rounded w-32 mb-3 animate-pulse"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2].map((frameI) => (
              <div key={frameI} className="bg-surface border border-border rounded-lg p-5 animate-pulse">
                <div className="h-4 bg-bg rounded w-1/4 mb-3"></div>
                <div className="h-4 bg-bg rounded w-3/4 mb-4"></div>
                <div className="h-3 bg-bg rounded w-full mb-2"></div>
                <div className="h-3 bg-bg rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
