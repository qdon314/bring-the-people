'use client'

import React from 'react'
import Link from 'next/link'
import type { CycleProgress, CycleNextAction } from '@/features/cycles/getCycleProgress'
import { cn } from '@/shared/lib/utils'

const ACTION_CONFIG: Record<
  Exclude<CycleNextAction, 'complete'>,
  { label: string; description: string; tab: string }
> = {
  plan: {
    label: 'Go to Plan',
    description: 'Approve segments and frames to start the cycle.',
    tab: 'plan',
  },
  create: {
    label: 'Go to Create',
    description: 'Generate and approve creative variants.',
    tab: 'create',
  },
  run: {
    label: 'Go to Run',
    description: 'Launch experiment runs for this cycle.',
    tab: 'run',
  },
  results: {
    label: 'Go to Results',
    description: 'Enter observations and review performance.',
    tab: 'results',
  },
  memo: {
    label: 'Go to Memo',
    description: 'Generate the cycle summary memo.',
    tab: 'memo',
  },
}

interface NextActionPanelProps {
  progress: CycleProgress
  showId: string
  cycleId: string
}

export function NextActionPanel({ progress, showId, cycleId }: NextActionPanelProps) {
  if (progress.nextAction === 'complete') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-5 py-4">
        <p className="text-sm font-semibold text-green-800">Cycle complete</p>
        <p className="mt-1 text-sm text-green-700">All stages are done for this cycle.</p>
      </div>
    )
  }

  const config = ACTION_CONFIG[progress.nextAction]
  const href = `/shows/${showId}/cycles/${cycleId}/${config.tab}`

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-blue-600">Next action</p>
      <p className="mt-1 text-sm text-blue-900">{config.description}</p>
      <Link
        href={href}
        className={cn(
          'mt-3 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white',
          'hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
        )}
      >
        {config.label}
      </Link>
    </div>
  )
}

export function NextActionPanelSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse rounded-lg border border-gray-200 bg-gray-100 px-5 py-4">
      <div className="h-3 w-20 rounded bg-gray-300" />
      <div className="mt-2 h-4 w-56 rounded bg-gray-300" />
      <div className="mt-3 h-8 w-28 rounded bg-gray-300" />
    </div>
  )
}
