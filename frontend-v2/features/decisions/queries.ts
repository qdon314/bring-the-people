'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/queryKeys'
import { listDecisions } from './api'

export function useDecisions(runId: string) {
  return useQuery({
    queryKey: queryKeys.decisions.list(runId),
    queryFn: () => listDecisions(runId),
    enabled: !!runId,
  })
}
