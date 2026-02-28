import { useEffect, useRef, useState } from 'react'
import type { components } from '@/shared/api/generated/schema'
import { cycleKeys, eventKeys, frameKeys, memoKeys, segmentKeys, variantKeys } from '@/shared/queryKeys'
import type { QueryKey } from '@/shared/queryKeys'
import { getJob } from './api'

type JobResponse = components['schemas']['JobResponse']

type JobStatus = 'queued' | 'running' | 'completed' | 'failed'

type JobType = 'strategy' | 'creative' | 'memo'

export const TERMINAL_JOB_STATUSES = ['completed', 'failed'] as const

const JOB_TYPE_INVALIDATION_KEYS: Record<JobType, readonly QueryKey[]> = {
  strategy: [cycleKeys.all(), segmentKeys.all(), frameKeys.all(), eventKeys.all()],
  creative: [variantKeys.all(), frameKeys.all(), eventKeys.all()],
  memo: [memoKeys.all(), eventKeys.all()],
}

export function getJobPollingIntervalMs(elapsedMs: number): number {
  if (elapsedMs <= 5_000) return 1_000
  if (elapsedMs <= 30_000) return 2_000
  return 5_000
}

export function isTerminalJobStatus(status: string): status is (typeof TERMINAL_JOB_STATUSES)[number] {
  return TERMINAL_JOB_STATUSES.some((terminalStatus) => terminalStatus === status)
}

export function getJobInvalidationKeys(jobType: string): readonly QueryKey[] {
  if (jobType === 'strategy' || jobType === 'creative' || jobType === 'memo') {
    return JOB_TYPE_INVALIDATION_KEYS[jobType]
  }

  return []
}

interface UseJobPollingOptions {
  enabled?: boolean
  onComplete?: (job: JobResponse, invalidateKeys: readonly QueryKey[]) => void
  onFailed?: (job: JobResponse) => void
  onError?: (error: unknown) => void
  now?: () => number
}

interface UseJobPollingResult {
  job: JobResponse | null
  error: unknown
  isPolling: boolean
  isCompleted: boolean
  isFailed: boolean
  attemptCount: number
}

export function useJobPolling(
  jobId: string | null,
  {
    enabled = true,
    onComplete,
    onFailed,
    onError,
    now = Date.now,
  }: UseJobPollingOptions = {}
): UseJobPollingResult {
  const [job, setJob] = useState<JobResponse | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [attemptCount, setAttemptCount] = useState(0)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (!jobId || !enabled) {
      setIsPolling(false)
      return
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    startTimeRef.current = now()
    setJob(null)
    setError(null)
    setAttemptCount(0)
    setIsPolling(true)

    const poll = async () => {
      try {
        const response = await getJob(jobId)
        if (cancelled) return

        setJob(response)
        setAttemptCount((currentAttemptCount) => currentAttemptCount + 1)

        const status = response.status as JobStatus

        if (isTerminalJobStatus(status)) {
          setIsPolling(false)

          if (status === 'completed') {
            onComplete?.(response, getJobInvalidationKeys(response.job_type))
          } else {
            onFailed?.(response)
          }

          return
        }

        const elapsedMs = now() - (startTimeRef.current ?? now())
        // eslint-disable-next-line no-restricted-syntax
        timeoutId = setTimeout(poll, getJobPollingIntervalMs(elapsedMs))
      } catch (requestError) {
        if (cancelled) return

        setError(requestError)
        setIsPolling(false)
        onError?.(requestError)
      }
    }

    void poll()

    return () => {
      cancelled = true

      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [enabled, jobId, now, onComplete, onError, onFailed])

  return {
    job,
    error,
    isPolling,
    isCompleted: job?.status === 'completed',
    isFailed: job?.status === 'failed',
    attemptCount,
  }
}
