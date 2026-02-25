import { useQuery } from '@tanstack/react-query'
import { eventsApi } from '../api/events'

export function useEvents(showId: string, cycleId?: string, limit = 50) {
  return useQuery({
    queryKey: ['events', showId, cycleId, limit],
    queryFn: () => eventsApi.list(showId, cycleId, limit),
    enabled: !!showId,
  })
}
