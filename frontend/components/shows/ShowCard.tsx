'use client'
import Link from 'next/link'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { daysUntilShow, getShowStatus, formatDate } from '@/lib/utils/dates'
import { showsApi } from '@/lib/api/shows'
import type { Show } from '@/lib/types'

interface ShowCardProps {
  show: Show
}

export function ShowCard({ show }: ShowCardProps) {
  const qc = useQueryClient()
  const daysAway = daysUntilShow(show.show_time)
  const status = getShowStatus(show)
  const pct = show.tickets_total > 0
    ? Math.max(0, Math.min(100, Math.round((show.tickets_sold / show.tickets_total) * 100)))
    : 0

  const deleteMutation = useMutation({
    mutationFn: () => showsApi.delete(show.show_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shows'] })
    },
  })

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const confirmed = window.confirm(
      `Delete "${show.artist_name}"? This will also delete all experiments, segments, and data. This cannot be undone.`
    )
    if (confirmed) {
      deleteMutation.mutate()
    }
  }

  return (
    <div className="p-5 bg-surface border border-border rounded-lg card-hover group">
      <div className="flex items-start justify-between mb-3">
        <Link href={`/shows/${show.show_id}/overview`} className="flex-1 min-w-0">
          <div>
            <h3 className="font-semibold">{show.artist_name}</h3>
            <p className="text-sm text-text-muted">{show.venue}, {show.city}</p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-text-muted hover:text-danger rounded focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-danger"
            title="Delete show"
            aria-label={`Delete ${show.artist_name}`}
          >
            {deleteMutation.isPending ? (
              <span className="text-xs">...</span>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <Link href={`/shows/${show.show_id}/overview`}>
        <p className="text-sm mb-3">
          {formatDate(show.show_time)}
          {daysAway > 0 && (
            <span className="ml-2 font-medium text-text">{daysAway} days away</span>
          )}
        </p>

        {/* Capacity bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-text-muted">
            <span>{show.tickets_sold.toLocaleString()} sold</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-bg rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-text-muted">{show.capacity.toLocaleString()} capacity</p>
        </div>
      </Link>
    </div>
  )
}

function StatusBadge({ status }: { status: 'past' | 'active' }) {
  const styles = {
    past: 'bg-text-muted/10 text-text-muted',
    active: 'bg-success/10 text-success',
  }

  const labels = {
    past: 'Past',
    active: 'Active',
  }

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}
