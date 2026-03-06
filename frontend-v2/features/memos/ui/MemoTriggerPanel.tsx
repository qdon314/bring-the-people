'use client'

import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useJobPolling } from '@/features/jobs/useJobPolling'
import { useRunMemo } from '../mutations'
import { ErrorBanner } from '@/shared/ui/ErrorBanner'
import { SpinnerIcon } from '@/shared/ui/SpinnerIcon'
import { showToast } from '@/shared/ui/toast'
import { queryKeys } from '@/shared/queryKeys'

interface MemoTriggerPanelProps {
  showId: string
  cycleStart: string
  cycleEnd: string
}

export function MemoTriggerPanel({ showId, cycleStart, cycleEnd }: MemoTriggerPanelProps) {
  const [jobId, setJobId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const runMemoMutation = useRunMemo(showId)

  const handleGenerateMemo = async () => {
    try {
      const result = await runMemoMutation.mutateAsync({ cycleStart, cycleEnd })
      setJobId(result.job_id)
    } catch {
      // Error handled by mutation state
    }
  }

  const { isPolling, error: pollingError } = useJobPolling(jobId, {
    enabled: !!jobId,
    onComplete: () => {
      showToast('Memo generated', 'success')
      setJobId(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.memos.list(showId) })
    },
    onFailed: () => {
      showToast('Memo generation failed. Try again.', 'error')
      setJobId(null)
    },
  })

  const isPending = runMemoMutation.isPending || isPolling
  const networkError = Boolean(runMemoMutation.error || pollingError)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Generate Memo</h2>
            <p className="mt-1 text-sm text-gray-500">
              Generate a cycle summary memo for this show
            </p>
          </div>
          <button
            onClick={handleGenerateMemo}
            disabled={isPending}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending && <SpinnerIcon className="h-4 w-4 text-white" />}
            {isPending ? 'Generating...' : 'Generate Memo'}
          </button>
        </div>

        {networkError && !isPending && (
          <ErrorBanner
            message={runMemoMutation.isError ? 'Failed to start memo generation' : 'Network error'}
            onRetry={handleGenerateMemo}
          />
        )}
      </div>
    </div>
  )
}
