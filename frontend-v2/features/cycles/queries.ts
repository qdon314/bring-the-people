'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/queryKeys'
import { listCycles, getCycle, createCycle } from './api'

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

export function useCreateCycle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (showId: string) => createCycle(showId),
    onSuccess: (cycle) => {
      qc.invalidateQueries({ queryKey: queryKeys.cycles.list(cycle.show_id) })
    },
  })
}
