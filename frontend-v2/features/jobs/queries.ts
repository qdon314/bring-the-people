'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/queryKeys'
import { getJob } from './api'

export function useJob(jobId: string | null) {
  return useQuery({
    queryKey: queryKeys.jobs.detail(jobId ?? ''),
    queryFn: () => getJob(jobId!),
    enabled: !!jobId,
  })
}
