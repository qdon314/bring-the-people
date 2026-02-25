import { useQuery } from '@tanstack/react-query'
import { jobsApi } from '../api/jobs'
import { useState } from 'react'
import type { BackgroundJob } from '../types'

function getInterval(elapsed: number): number {
  if (elapsed < 20_000) return 2_000
  if (elapsed < 80_000) return 4_000
  return 8_000
}

export function useJobPoller(jobId: string | null) {
  const startTime = useState(() => Date.now())[0]

  return useQuery<BackgroundJob>({
    queryKey: ['jobs', jobId],
    queryFn: () => jobsApi.get(jobId!),
    enabled: !!jobId,
    refetchInterval: (data) => {
      if (!data || data.status === 'queued' || data.status === 'running') {
        return getInterval(Date.now() - startTime)
      }
      return false  // stop polling when completed or failed
    },
    staleTime: 0,
  })
}
