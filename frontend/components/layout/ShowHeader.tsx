import type { Show } from '@/lib/types'
import { daysUntilShow, getShowPhaseLabel, formatDate, getShowStatus } from '@/lib/utils/dates'

export function ShowHeader({ show }: { show: Show }) {
  const daysAway = daysUntilShow(show.show_time)
  const phase = getShowPhaseLabel(Math.max(0, daysAway))
  const status = getShowStatus(show)
  const pct = show.tickets_total > 0
    ? Math.max(0, Math.min(100, Math.round((show.tickets_sold / show.tickets_total) * 100)))
    : 0

  return (
    <header className="bg-surface border-b border-border px-8 py-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold tracking-tight">{show.artist_name}</h2>
            <span
              className={`px-2 py-1 text-xs font-medium rounded ${
                status === 'active' ? 'bg-success/10 text-success' : 'bg-text-muted/10 text-text-muted'
              }`}
            >
              {status === 'active' ? 'Active' : 'Past'}
            </span>
          </div>
          <p className="text-text-muted text-sm">
            {show.venue}, {show.city} · {formatDate(show.show_time)} ·{' '}
            <span className="font-medium text-text">
              {daysAway > 0 ? `${daysAway} days away` : daysAway === 0 ? 'Today' : `${Math.abs(daysAway)} days ago`}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-text-muted mb-1">Ticket Sales</p>
          <p className="text-2xl font-bold">
            {show.tickets_sold.toLocaleString()}{' '}
            <span className="text-base font-normal text-text-muted">
              / {show.tickets_total.toLocaleString()}
            </span>
          </p>
          <div
            className="w-48 h-2 bg-bg rounded-full mt-2 overflow-hidden"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${pct}% of tickets sold`}
          >
            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-text-muted mt-1">
            {pct}% capacity · {status === 'active' ? `${phase} phase` : 'Past show'}
          </p>
        </div>
      </div>
    </header>
  )
}
