'use client'

import React from 'react'
import { ErrorBanner } from '@/shared/ui/ErrorBanner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { useFrames } from '../queries'
import { FrameCard, FrameCardSkeleton } from './FrameCard'

interface FrameListProps {
  showId: string
  cycleId?: string
}

export function FrameList({ showId, cycleId }: FrameListProps) {
  const { data, isPending, isError, refetch } = useFrames(showId, cycleId)

  if (isPending) {
    return <FrameListSkeleton />
  }

  if (isError) {
    return <ErrorBanner message="Failed to load frames." onRetry={() => refetch()} />
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="No frames yet."
        description="Run the strategy agent to generate creative frames."
      />
    )
  }

  return (
    <ul className="space-y-3">
      {data.map((frame) => (
        <li key={frame.frame_id}>
          <FrameCard frame={frame} showId={showId} />
        </li>
      ))}
    </ul>
  )
}

export function FrameListSkeleton() {
  return (
    <ul aria-hidden="true" className="space-y-3">
      {[0, 1, 2].map((i) => (
        <li key={i}>
          <FrameCardSkeleton />
        </li>
      ))}
    </ul>
  )
}
