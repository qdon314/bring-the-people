import { useQuery } from '@tanstack/react-query'
import { decisionsApi } from '../api/decisions'

export function useDecisions(experimentId: string) {
  return useQuery({
    queryKey: ['decisions', experimentId],
    queryFn: () => decisionsApi.list(experimentId),
    enabled: !!experimentId,
  })
}
