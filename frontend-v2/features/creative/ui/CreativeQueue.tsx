'use client'

import React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useJobPolling } from '@/features/jobs/useJobPolling'
import { SpinnerIcon } from '@/shared/ui/SpinnerIcon'
import { showToast } from '@/shared/ui/toast'
import { queryKeys } from '@/shared/queryKeys'

interface CreativeQueueProps {
  jobs: Array<{ frameId: string; jobId: string }>
  onJobComplete: (frameId: string) => void
  onJobFailed: (frameId: string) => void
}

interface CreativeJobRowProps {
  frameId: string
  jobId: string
  onJobComplete: (frameId: string) => void
  onJobFailed: (frameId: string) => void
}

function CreativeJobRow({ frameId, jobId, onJobComplete, onJobFailed }: CreativeJobRowProps) {
  const queryClient = useQueryClient()

  useJobPolling(jobId, {
    enabled: true,
    onComplete: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.variants.byFrame(frameId) })
      showToast('Variants generated', 'success')
      onJobComplete(frameId)
    },
    onFailed: () => {
      showToast('Variant generation failed. Try again.', 'error')
      onJobFailed(frameId)
    },
  })

  return (
    <li className="flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-3 text-sm text-text">
      <SpinnerIcon className="h-4 w-4 shrink-0 text-primary" />
      <span>Generating variants for frame…</span>
    </li>
  )
}

export function CreativeQueue({ jobs, onJobComplete, onJobFailed }: CreativeQueueProps) {
  if (jobs.length === 0) {
    return null
  }

  return (
    <ul className="space-y-2">
      {jobs.map(({ frameId, jobId }) => (
        <CreativeJobRow
          key={jobId}
          frameId={frameId}
          jobId={jobId}
          onJobComplete={onJobComplete}
          onJobFailed={onJobFailed}
        />
      ))}
    </ul>
  )
}
