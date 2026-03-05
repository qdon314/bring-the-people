'use client'

import { useShow } from '@/features/shows/queries'
import { useOverviewSnapshot } from '@/features/overview/useOverviewSnapshot'
import { getCycleProgress } from '@/features/cycles/getCycleProgress'
import { NextActionPanel, NextActionPanelSkeleton } from '@/features/overview/ui/NextActionPanel'
import { KPIGrid, KPIGridSkeleton } from '@/features/overview/ui/KPIGrid'
import { ActivityFeed } from '@/features/events/ui/ActivityFeed'
import { ErrorBanner } from '@/shared/ui/ErrorBanner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { mapApiError } from '@/shared/errors/mapApiError'

interface OverviewDashboardProps {
  showId: string
  cycleId: string
}

function isSnapshotEmpty(
  snapshot: NonNullable<ReturnType<typeof useOverviewSnapshot>['snapshot']>
): boolean {
  return (
    snapshot.segments.length === 0 &&
    snapshot.frames.length === 0 &&
    snapshot.runs.length === 0 &&
    snapshot.memos.length === 0
  )
}

export function OverviewDashboard({ showId, cycleId }: OverviewDashboardProps) {
  const showQuery = useShow(showId)
  const { snapshot, fullObservations, events, isLoading, isError, error } = useOverviewSnapshot({
    showId,
    cycleId,
  })

  const anyError = isError || showQuery.isError
  const anyLoading = isLoading || showQuery.isPending

  if (anyError) {
    const mapped =
      error != null
        ? mapApiError(error)
        : showQuery.error != null
        ? mapApiError(showQuery.error)
        : null
    const message = mapped?.message ?? 'Something went wrong loading the overview.'
    return (
      <main className="p-8">
        <ErrorBanner message={message} />
      </main>
    )
  }

  if (anyLoading || !snapshot || !showQuery.data || fullObservations === undefined) {
    return (
      <main className="space-y-6 p-8">
        <NextActionPanelSkeleton />
        <KPIGridSkeleton />
      </main>
    )
  }

  const progress = getCycleProgress(snapshot)
  const empty = isSnapshotEmpty(snapshot)

  return (
    <main className="space-y-6 p-8">
      <NextActionPanel progress={progress} showId={showId} cycleId={cycleId} />
      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="mb-3 text-sm font-semibold text-gray-700">
          Performance
        </h2>
        <KPIGrid show={showQuery.data} observations={fullObservations} />
      </section>
      <section aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="mb-3 text-sm font-semibold text-gray-700">
          Recent activity
        </h2>
        {empty && !events?.length ? (
          <EmptyState
            title="Nothing here yet"
            description="Start with the Plan tab to kick off this cycle."
          />
        ) : (
          <ActivityFeed events={events ?? []} />
        )}
      </section>
    </main>
  )
}
