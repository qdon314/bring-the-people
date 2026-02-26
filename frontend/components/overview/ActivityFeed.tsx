import { timeSince } from '@/lib/utils/dates'
import type { DomainEvent } from '@/lib/types'

const EVENT_DOT_COLOR: Record<string, string> = {
  'experiment.launched': 'bg-success',
  'experiment.approved': 'bg-success',
  'decision.issued': 'bg-primary',
  'memo.published': 'bg-accent',
  'strategy.completed': 'bg-accent',
  'creative.completed': 'bg-accent',
}

export function ActivityFeed({ events }: { events: DomainEvent[] }) {
  if (!events.length) {
    return (
      <div className="bg-surface border border-border rounded-lg p-5">
        <h3 className="font-semibold mb-4">Recent Activity</h3>
        <p className="text-sm text-text-muted">No activity yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-lg">
      <div className="p-5 border-b border-border">
        <h3 className="font-semibold">Recent Activity</h3>
      </div>
      <div className="p-4">
        <ol className="space-y-4">
          {events.slice(0, 10).map((event, i) => (
            <li key={event.event_id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`w-2 h-2 rounded-full mt-2 shrink-0 ${EVENT_DOT_COLOR[event.type] ?? 'bg-text-muted'}`}
                  aria-hidden="true"
                />
                {i < 9 && <span className="w-px flex-1 bg-border mt-1" aria-hidden="true" />}
              </div>
              <div className="pb-4">
                <p className="text-sm">
                  <span className="font-medium">{event.display.title}</span>
                </p>
                {event.display.subtitle && (
                  <p className="text-xs text-text-muted mt-0.5">{event.display.subtitle}</p>
                )}
                <time className="text-xs text-text-muted">{timeSince(event.at)}</time>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
