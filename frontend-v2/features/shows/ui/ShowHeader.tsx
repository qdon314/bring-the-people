import React from 'react'
import { cn } from '@/shared/lib/utils'
import type { components } from '@/shared/api/generated/schema'

type ShowResponse = components['schemas']['ShowResponse']
type CycleResponse = components['schemas']['CycleResponse']

interface ShowHeaderProps {
  show: ShowResponse
  cycle?: CycleResponse | null
}

function computeDaysUntilShow(showTime: string): number {
  const showDate = new Date(showTime)
  const today = new Date()
  const diffTime = showDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

function computeShowPhase(daysUntilShow: number): {
  label: string
  className: string
} {
  if (daysUntilShow > 60) return { label: 'Early', className: 'bg-accent-light text-accent' }
  if (daysUntilShow > 8) return { label: 'Mid', className: 'bg-warning-light text-warning' }
  return { label: 'Late', className: 'bg-danger-light text-danger' }
}

function formatShowDate(showTime: string, timezone: string): string {
  return new Date(showTime).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  })
}

function formatCycleDate(startedAt: string): string {
  return new Date(startedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ShowHeader({ show, cycle }: ShowHeaderProps) {
  const daysUntilShow = computeDaysUntilShow(show.show_time)
  const showPhase = computeShowPhase(daysUntilShow)
  const formattedShowDate = formatShowDate(show.show_time, show.timezone)
  const cycleLabel = cycle
    ? (cycle.label ?? `Cycle started ${formatCycleDate(cycle.started_at)}`)
    : null

  return (
    <div className="flex flex-col gap-1 border-b border-border bg-surface px-6 py-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-text">{show.artist_name}</h1>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-medium',
            showPhase.className,
          )}
        >
          {showPhase.label}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
        <span>
          {show.city} · {show.venue}
        </span>
        <span>{formattedShowDate}</span>
        <span>
          {daysUntilShow === 0 ? 'Show day' : `${daysUntilShow} days away`}
        </span>
        {cycleLabel && <span className="text-text">{cycleLabel}</span>}
      </div>
    </div>
  )
}

export function ShowHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-1 border-b border-border bg-surface px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="h-6 w-40 animate-pulse rounded bg-border" />
        <div className="h-5 w-14 animate-pulse rounded-full bg-border" />
      </div>
      <div className="flex items-center gap-4">
        <div className="h-4 w-32 animate-pulse rounded bg-border" />
        <div className="h-4 w-28 animate-pulse rounded bg-border" />
        <div className="h-4 w-20 animate-pulse rounded bg-border" />
      </div>
    </div>
  )
}
