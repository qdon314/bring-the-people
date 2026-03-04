import React from 'react'
import Link from 'next/link'
import type { components } from '@/shared/api/generated/schema'

type ShowResponse = components['schemas']['ShowResponse']

interface ShowCardProps {
  show: ShowResponse
}

export function ShowCard({ show }: ShowCardProps) {
  const showDate = new Date(show.show_time)
  const formattedDate = showDate.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  const soldPct = show.tickets_total > 0
    ? Math.round((show.tickets_sold / show.tickets_total) * 100)
    : 0

  return (
    <Link
      href={`/shows/${show.show_id}`}
      className="block rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary hover:bg-primary-light"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-text">{show.artist_name}</h2>
          <p className="mt-0.5 truncate text-sm text-text-muted">
            {show.venue}, {show.city}
          </p>
          <p className="mt-1 text-sm text-text-muted">{formattedDate}</p>
        </div>

        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-medium text-text">
            {show.tickets_sold.toLocaleString()}/{show.tickets_total.toLocaleString()}
          </p>
          <p className="text-xs text-text-muted">{soldPct}% sold</p>
        </div>
      </div>
    </Link>
  )
}
