'use client'

import React, { useMemo } from 'react'
import { ErrorBanner } from '@/shared/ui/ErrorBanner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { useExperiments } from '@/features/experiments/queries'
import { useRunsByCycle } from '../queries'
import { RunCard, RunCardSkeleton } from './RunCard'
import { RunActions } from './RunActions'

interface RunListProps {
  showId: string
  cycleId: string
}

export function RunList({ showId, cycleId }: RunListProps) {
  const { data: runs, isLoading: runsLoading, error: runsError } = useRunsByCycle(cycleId)
  const { data: experiments, isLoading: experimentsLoading } = useExperiments(showId)

  const experimentMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof experiments>[0]>()
    if (experiments) {
      for (const exp of experiments) {
        map.set(exp.experiment_id, exp)
      }
    }
    return map
  }, [experiments])

  const isLoading = runsLoading || experimentsLoading

  if (runsError) return <ErrorBanner message="Failed to load runs. Try again or refresh the page." />

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <RunCardSkeleton />
        <RunCardSkeleton />
      </div>
    )
  }

  if (!runs || runs.length === 0) {
    return (
      <EmptyState
        title="No runs yet"
        description="Create a run by picking an experiment from the library above."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {runs.map((run) => (
        <div key={run.run_id} className="flex flex-col gap-2">
          <RunCard run={run} experiment={experimentMap.get(run.experiment_id)} />
          <div className="flex justify-end">
            <RunActions run={run} />
          </div>
        </div>
      ))}
    </div>
  )
}
