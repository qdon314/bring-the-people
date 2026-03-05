'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/queryKeys'
import { listExperiments } from './api'

export function useExperiments(showId: string) {
  return useQuery({
    queryKey: queryKeys.experiments.list(showId),
    queryFn: () => listExperiments(showId),
    enabled: !!showId,
  })
}
