'use client'

import React from 'react'
import type { EventResponse } from '@/features/events/api'

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface ActivityFeedProps {
  events: EventResponse[]
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  if (events.length === 0) {
    return <p className="text-sm text-gray-400">No activity yet.</p>
  }

  const sorted = [...events].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  )

  return (
    <ol aria-label="Recent activity" className="space-y-3">
      {sorted.map((event) => (
        <li key={event.event_id} className="flex items-start gap-3">
          <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800">{event.display.title}</p>
            {event.display.subtitle && (
              <p className="text-xs text-gray-500">{event.display.subtitle}</p>
            )}
          </div>
          <time
            dateTime={event.at}
            className="ml-auto shrink-0 text-xs text-gray-400"
          >
            {formatRelativeTime(event.at)}
          </time>
        </li>
      ))}
    </ol>
  )
}
