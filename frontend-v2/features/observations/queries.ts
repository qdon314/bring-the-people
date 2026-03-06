'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/queryKeys'
import { createObservation, createObservationsBulk, listObservations } from './api'

export function useObservations(runId: string) {
  return useQuery({
    queryKey: queryKeys.observations.list(runId),
    queryFn: () => listObservations(runId),
    enabled: !!runId,
  })
}

export function useCreateObservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createObservation,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.observations.list(variables.run_id) })
    },
  })
}

export function useCreateObservationsBulk() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createObservationsBulk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['observations'] })
    },
  })
}
