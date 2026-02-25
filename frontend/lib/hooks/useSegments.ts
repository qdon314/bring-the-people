import { useQuery } from '@tanstack/react-query'
import { segmentsApi } from '../api/segments'

export function useSegments(showId: string, cycleId?: string) {
  return useQuery({
    queryKey: ['segments', showId, cycleId],
    queryFn: () => segmentsApi.list(showId, cycleId),
    enabled: !!showId,
  })
}

export function useSegment(segmentId: string) {
  return useQuery({
    queryKey: ['segments', segmentId],
    queryFn: () => segmentsApi.get(segmentId),
    enabled: !!segmentId,
  })
}
