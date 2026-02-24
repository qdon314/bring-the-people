import Link from 'next/link'
import { daysUntilShow, getShowStatus, formatDate } from '@/lib/utils/dates'
import type { Show } from '@/lib/types'

export function ShowCard({ show }: { show: Show }) {
  const daysAway = daysUntilShow(show.show_time)
  const status = getShowStatus(show)
  const pct = Math.round((show.tickets_sold / show.tickets_total) * 100)

  return (
    <Link href={`/shows/${show.show_id}/overview`}>
      <div className="p-5 bg-surface border border-border rounded-lg card-hover cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold">{show.artist_name}</h3>
            <p className="text-sm text-text-muted">{show.venue}, {show.city}</p>
          </div>
          <StatusBadge status={status} />
        </div>

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
      </div>
    </Link>
  )
}

function StatusBadge({ status }: { status: 'past' | 'active' | 'draft' }) {
  const styles = {
    past: 'bg-text-muted/10 text-text-muted',
    active: 'bg-success/10 text-success',
    draft: 'bg-border text-text-muted',
  }

  const labels = {
    past: 'Past',
    active: 'Active',
    draft: 'Draft',
  }

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}
