'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/queryKeys'
import { listSegments } from './api'

export function useSegments(showId: string, cycleId?: string) {
  return useQuery({
    queryKey: queryKeys.segments.list(showId, cycleId),
    queryFn: () => listSegments(showId, cycleId),
    enabled: !!showId,
  })
}
