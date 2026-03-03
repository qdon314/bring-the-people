'use client'

import React, { useMemo } from 'react'
import { cn } from '@/shared/lib/utils'
import type { components } from '@/shared/api/generated/schema'

type ShowResponse = components['schemas']['ShowResponse']
type CycleResponse = components['schemas']['CycleResponse']

interface TopBarProps {
  show: ShowResponse
  cycle: CycleResponse
}

export function TopBar({ show, cycle }: TopBarProps) {
  const daysUntilShow = useMemo(() => {
    const showDate = new Date(show.show_time)
    const today = new Date()
    const diffTime = showDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }, [show.show_time])

  const salesProgress = useMemo(() => {
    if (show.capacity === 0) return 0
    return Math.round((show.tickets_sold / show.capacity) * 100)
  }, [show.tickets_sold, show.capacity])

  const showPhase = useMemo(() => {
    if (daysUntilShow > 60) return { label: 'Early', className: 'bg-accent-light text-accent' }
    if (daysUntilShow > 8) return { label: 'Mid', className: 'bg-warning-light text-warning' }
    return { label: 'Late', className: 'bg-danger-light text-danger' }
  }, [daysUntilShow])

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-text">
          {show.artist_name}
        </h1>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', showPhase.className)}>
          {showPhase.label}
        </span>
      </div>

      <div className="flex items-center gap-6">
        {/* Days until show */}
        <div className="text-right">
          <p className="text-xs text-text-muted">Days until show</p>
          <p className="text-lg font-semibold text-text">{daysUntilShow}</p>
        </div>

        {/* Sales progress */}
        <div className="w-32">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">Tickets</span>
            <span className="font-medium text-text">
              {show.tickets_sold}/{show.capacity}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-success transition-all duration-300"
              style={{ width: `${salesProgress}%` }}
            />
          </div>
        </div>
      </div>
    </header>
  )
}

interface TopBarSkeletonProps {
  className?: string
}

export function TopBarSkeleton({ className }: TopBarSkeletonProps) {
  return (
    <header className={cn('flex h-16 items-center justify-between border-b border-border bg-surface px-6', className)}>
      <div className="flex items-center gap-4">
        <div className="h-6 w-32 animate-pulse rounded bg-border" />
        <div className="h-6 w-14 animate-pulse rounded-full bg-border" />
      </div>

      <div className="flex items-center gap-6">
        <div className="text-right">
          <div className="h-3 w-20 animate-pulse rounded bg-border" />
          <div className="mt-1 h-6 w-8 animate-pulse rounded bg-border" />
        </div>

        <div className="w-32">
          <div className="flex items-center justify-between">
            <div className="h-3 w-14 animate-pulse rounded bg-border" />
            <div className="h-3 w-12 animate-pulse rounded bg-border" />
          </div>
          <div className="mt-1 h-2 w-full animate-pulse rounded-full bg-border" />
        </div>
      </div>
    </header>
  )
}
