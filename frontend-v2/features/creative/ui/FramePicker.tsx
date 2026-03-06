'use client'

import React, { useState } from 'react'
import { useFrames } from '@/features/frames/queries'
import { useRunCreative } from '../mutations'
import { ErrorBanner } from '@/shared/ui/ErrorBanner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { showToast } from '@/shared/ui/toast'
import { cn } from '@/shared/lib/utils'

interface FramePickerProps {
  showId: string
  cycleId: string
  onJobsStarted: (jobs: Array<{ frameId: string; jobId: string }>) => void
}

export function FramePicker({ showId, cycleId, onJobsStarted }: FramePickerProps) {
  const { data, isPending, isError, refetch } = useFrames(showId, cycleId)
  const runCreativeMutation = useRunCreative()

  const [selectedFrameIds, setSelectedFrameIds] = useState<Set<string>>(new Set())
  const [runningFrameIds, setRunningFrameIds] = useState<Set<string>>(new Set())

  if (isPending) {
    return <FramePickerSkeleton />
  }

  if (isError) {
    return (
      <ErrorBanner
        message="Failed to load frames."
        onRetry={() => refetch()}
      />
    )
  }

  const approvedFrames = (data ?? []).filter((f) => f.review_status === 'approved')

  if (approvedFrames.length === 0) {
    return (
      <EmptyState
        title="No approved frames yet."
        description="Approve frames in the Plan tab."
      />
    )
  }

  const toggleFrame = (frameId: string) => {
    setSelectedFrameIds((prev) => {
      const next = new Set(prev)
      if (next.has(frameId)) {
        next.delete(frameId)
      } else {
        next.add(frameId)
      }
      return next
    })
  }

  const hasRunningSelected = [...selectedFrameIds].some((id) => runningFrameIds.has(id))
  const isGenerateDisabled = selectedFrameIds.size === 0 || hasRunningSelected

  const handleGenerate = async () => {
    const frameIds = [...selectedFrameIds]
    const results: Array<{ frameId: string; jobId: string }> = []

    for (const frameId of frameIds) {
      try {
        const result = await runCreativeMutation.mutateAsync(frameId)
        results.push({ frameId, jobId: result.job_id })
        setRunningFrameIds((prev) => new Set([...prev, frameId]))
      } catch {
        showToast(`Failed to enqueue creative job for frame ${frameId}. Try again.`, 'error')
      }
    }

    if (results.length > 0) {
      setSelectedFrameIds(new Set())
      onJobsStarted(results)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="space-y-2">
        {approvedFrames.map((frame) => {
          const isSelected = selectedFrameIds.has(frame.frame_id)
          const isRunning = runningFrameIds.has(frame.frame_id)
          return (
            <li key={frame.frame_id}>
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-surface hover:bg-bg',
                  isRunning && 'opacity-60',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary accent-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                  checked={isSelected}
                  disabled={isRunning}
                  onChange={() => toggleFrame(frame.frame_id)}
                />
                <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                  <span className="text-sm text-text">{frame.hypothesis}</span>
                  <span className="shrink-0 rounded-full bg-bg px-2 py-0.5 text-xs font-medium text-text-muted">
                    {frame.channel}
                  </span>
                </div>
              </label>
            </li>
          )
        })}
      </ul>

      <button
        onClick={handleGenerate}
        disabled={isGenerateDisabled}
        className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Generate variants
      </button>
    </div>
  )
}

export function FramePickerSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <ul className="space-y-2">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-14 animate-pulse rounded-md bg-bg" />
        ))}
      </ul>
      <div className="h-9 w-36 animate-pulse rounded-md bg-bg" />
    </div>
  )
}
