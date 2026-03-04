'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/queryKeys'
import { listObservations } from './api'

export function useObservations(experimentId: string) {
  return useQuery({
    queryKey: queryKeys.observations.list(experimentId),
    queryFn: () => listObservations(experimentId),
    enabled: !!experimentId,
  })
}
