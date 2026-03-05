'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/queryKeys'
import { listObservations } from './api'

export function useObservations(runId: string) {
  return useQuery({
    queryKey: queryKeys.observations.list(runId),
    queryFn: () => listObservations(runId),
    enabled: !!runId,
  })
}
