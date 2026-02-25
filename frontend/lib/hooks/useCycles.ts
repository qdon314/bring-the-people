import { useQuery } from '@tanstack/react-query'
import { cyclesApi } from '../api/cycles'

export function useCycles(showId: string) {
  return useQuery({
    queryKey: ['cycles', showId],
    queryFn: () => cyclesApi.list(showId),
    enabled: !!showId,
  })
}
