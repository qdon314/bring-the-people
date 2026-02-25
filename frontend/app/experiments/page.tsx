'use client'
import Link from 'next/link'
import { useShows } from '@/lib/hooks/useShow'

export default function ExperimentsPage() {
  const { data: shows, isLoading } = useShows()

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-8">
        <h2 className="text-2xl font-bold tracking-tight mb-2">Experiments</h2>
        <p className="text-sm text-text-muted mb-6">
          Experiments are managed per show. Pick a show to open its Run tab.
        </p>

        {isLoading && (
          <p className="text-text-muted">Loading shows…</p>
        )}

        {!isLoading && (!shows || shows.length === 0) && (
          <div className="rounded-lg border border-border bg-surface p-6 text-center">
            <p className="text-text-muted mb-3">No shows yet.</p>
            <Link href="/shows/new" className="btn-primary">Create your first show</Link>
          </div>
        )}

        {shows && shows.length > 0 && (
          <ul className="space-y-3">
            {shows.map((show) => (
              <li key={show.show_id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{show.artist_name}</p>
                    <p className="text-sm text-text-muted">{show.venue}, {show.city}</p>
                  </div>
                  <Link href={`/shows/${show.show_id}/run`} className="btn-secondary">
                    Open Run Tab
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
