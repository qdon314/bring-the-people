import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/queryKeys'
import { listDecisions } from './api'

export function useDecisions(experimentId: string) {
  return useQuery({
    queryKey: queryKeys.decisions.list(experimentId),
    queryFn: () => listDecisions(experimentId),
    enabled: !!experimentId,
  })
}
