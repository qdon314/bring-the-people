'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/queryKeys'
import { evaluateRun, listDecisions } from './api'

export function useDecisions(runId: string) {
  return useQuery({
    queryKey: queryKeys.decisions.list(runId),
    queryFn: () => listDecisions(runId),
    enabled: !!runId,
  })
}

export function useEvaluateRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: evaluateRun,
    onSuccess: (_, runId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions.list(runId) })
    },
  })
}
