'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/queryKeys'
import { listFrames } from './api'

export function useFrames(showId: string, cycleId?: string) {
  return useQuery({
    queryKey: queryKeys.frames.list(showId, cycleId),
    queryFn: () => listFrames(showId, cycleId),
    enabled: !!showId,
  })
}
