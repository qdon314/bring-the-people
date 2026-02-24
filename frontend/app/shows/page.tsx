'use client'
import { useShows } from '@/lib/hooks/useShow'
import { ShowCard } from '@/components/shows/ShowCard'
import Link from 'next/link'

export default function ShowsPage() {
  const { data: shows, isLoading, error } = useShows()

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-8 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold tracking-tight">Shows</h2>
          <Link 
            href="/shows/new"
            className="btn-primary"
          >
            + New Show
          </Link>
        </div>

        {/* Loading state */}
        {isLoading && <ShowsListSkeleton />}

        {/* Error state */}
        {error && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg text-danger">
            {error.message}
          </div>
        )}

        {/* Empty state */}
        {shows?.length === 0 && (
          <div className="text-center py-12">
            <p className="text-text-muted mb-4">No shows yet</p>
            <Link href="/shows/new" className="btn-primary">
              Create your first show
            </Link>
          </div>
        )}

        {/* Shows grid */}
        {shows && shows.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {shows.map(show => <ShowCard key={show.show_id} show={show} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function ShowsListSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {[1, 2, 3].map(i => (
        <div key={i} className="p-5 bg-surface border border-border rounded-lg animate-pulse">
          <div className="h-6 bg-bg rounded mb-2 w-3/4" />
          <div className="h-4 bg-bg rounded mb-4 w-1/2" />
          <div className="h-4 bg-bg rounded mb-3 w-2/3" />
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="h-3 bg-bg rounded w-20" />
              <div className="h-3 bg-bg rounded w-8" />
            </div>
            <div className="h-1.5 bg-bg rounded-full" />
            <div className="h-3 bg-bg rounded w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}
