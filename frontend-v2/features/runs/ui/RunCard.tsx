'use client'

import React from 'react'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { cn } from '@/shared/lib/utils'
import type { RunResponse } from '../api'
import type { ExperimentResponse } from '@/features/experiments/api'

interface RunCardProps {
  run: RunResponse
  experiment: ExperimentResponse | undefined
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function experimentLabel(experiment: ExperimentResponse | undefined): string {
  if (!experiment) return 'Unknown experiment'
  return `${experiment.channel} — ${experiment.objective}`
}

export function RunCard({ run, experiment }: RunCardProps) {
  const budgetOverride =
    run.budget_cap_cents_override != null
      ? `$${(run.budget_cap_cents_override / 100).toLocaleString()} override`
      : null

  return (
    <div className={cn('rounded-lg border border-border bg-surface p-5 flex flex-col gap-3')}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-text">{experimentLabel(experiment)}</span>
        <StatusBadge status={run.status as Parameters<typeof StatusBadge>[0]['status']} />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-muted">
        <span>Start: {formatDate(run.start_time)}</span>
        <span>End: {formatDate(run.end_time)}</span>
        {budgetOverride && <span className="text-text">{budgetOverride}</span>}
      </div>
    </div>
  )
}

export function RunCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 flex flex-col gap-3 animate-pulse">
      <div className="flex items-center justify-between gap-3">
        <div className="h-4 w-48 rounded bg-bg" />
        <div className="h-5 w-20 rounded-full bg-bg" />
      </div>
      <div className="flex gap-6">
        <div className="h-3 w-24 rounded bg-bg" />
        <div className="h-3 w-24 rounded bg-bg" />
      </div>
    </div>
  )
}
