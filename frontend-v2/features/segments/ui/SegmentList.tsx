'use client'

import React from 'react'
import { ErrorBanner } from '@/shared/ui/ErrorBanner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { useSegments } from '../queries'
import { SegmentCard, SegmentCardSkeleton } from './SegmentCard'

interface SegmentListProps {
  showId: string
  cycleId?: string
}

export function SegmentList({ showId, cycleId }: SegmentListProps) {
  const { data, isPending, isError, refetch } = useSegments(showId, cycleId)

  if (isPending) {
    return <SegmentListSkeleton />
  }

  if (isError) {
    return (
      <ErrorBanner
        message="Failed to load segments."
        onRetry={() => refetch()}
      />
    )
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="No segments yet. Run the strategy agent to generate audience segments."
      />
    )
  }

  return (
    <ul className="space-y-3">
      {data.map((segment) => (
        <li key={segment.segment_id}>
          <SegmentCard segment={segment} showId={showId} />
        </li>
      ))}
    </ul>
  )
}

export function SegmentListSkeleton() {
  return (
    <ul aria-hidden="true" className="space-y-3">
      {[0, 1, 2].map((i) => (
        <li key={i}>
          <SegmentCardSkeleton />
        </li>
      ))}
    </ul>
  )
}
