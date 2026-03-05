'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/queryKeys'
import { listEvents } from './api'

export function useEvents(showId: string, cycleId?: string) {
  return useQuery({
    queryKey: queryKeys.events.list(showId, cycleId),
    queryFn: () => listEvents(showId, cycleId),
    enabled: !!showId,
  })
}
