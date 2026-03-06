'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/shared/api/client'
import { queryKeys } from '@/shared/queryKeys'

interface CreateExperimentVariables {
  showId: string
  originCycleId: string
  segmentId: string
  frameId: string
  channel: string
  objective: string
  budgetCapCents: number
}

export function useCreateExperiment(showId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      originCycleId,
      segmentId,
      frameId,
      channel,
      objective,
      budgetCapCents,
    }: Omit<CreateExperimentVariables, 'showId'>) =>
      apiClient.post('/api/experiments', {
        body: {
          show_id: showId,
          origin_cycle_id: originCycleId,
          segment_id: segmentId,
          frame_id: frameId,
          channel,
          objective,
          budget_cap_cents: budgetCapCents,
          baseline_snapshot: {},
        },
      }),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.experiments.list(showId) })
    },
  })
}
