'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/queryKeys'
import { listCycles, getCycle } from './api'

export function useCycles(showId: string) {
  return useQuery({
    queryKey: queryKeys.cycles.list(showId),
    queryFn: () => listCycles(showId),
    enabled: !!showId,
  })
}

export function useCycle(cycleId: string) {
  return useQuery({
    queryKey: queryKeys.cycles.detail(cycleId),
    queryFn: () => getCycle(cycleId),
    enabled: !!cycleId,
  })
}
