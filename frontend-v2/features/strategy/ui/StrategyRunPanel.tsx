'use client'

import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useJobPolling } from '@/features/jobs/useJobPolling'
import { useRunStrategy } from '../mutations'
import { ErrorBanner } from '@/shared/ui/ErrorBanner'
import { SpinnerIcon } from '@/shared/ui/SpinnerIcon'
import { showToast } from '@/shared/ui/toast'
import { queryKeys } from '@/shared/queryKeys'

interface StrategyRunPanelProps {
  showId: string
  cycleId: string
}

export function StrategyRunPanel({ showId, cycleId }: StrategyRunPanelProps) {
  const [jobId, setJobId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const runStrategyMutation = useRunStrategy(showId, cycleId)

  const handleRunStrategy = async () => {
    try {
      const result = await runStrategyMutation.mutateAsync()
      setJobId(result.job_id)
    } catch {
      // Error handled by mutation state
    }
  }

  const { isPolling, isCompleted, isFailed, error: pollingError } = useJobPolling(jobId, {
    enabled: !!jobId,
    onComplete: () => {
      showToast('Strategy complete', 'success')
      setJobId(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.segments.list(showId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.frames.list(showId) })
    },
    onFailed: () => {
      showToast('Strategy failed. Try again.', 'error')
      setJobId(null)
    },
  })

  const isPending = runStrategyMutation.isPending || isPolling
  const networkError = Boolean(runStrategyMutation.error || pollingError)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Run Strategy</h2>
            <p className="mt-1 text-sm text-gray-500">
              Generate segment suggestions for this cycle
            </p>
          </div>
          <button
            onClick={handleRunStrategy}
            disabled={isPending}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending && <SpinnerIcon className="h-4 w-4 text-white" />}
            {isPending ? 'Running...' : 'Run Strategy'}
          </button>
        </div>

        {networkError && !isPending && (
          <ErrorBanner
            message={runStrategyMutation.isError ? 'Failed to start strategy' : 'Network error'}
            onRetry={handleRunStrategy}
          />
        )}
      </div>
    </div>
  )
}
