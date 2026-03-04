'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/queryKeys'
import { listShows, getShow } from './api'

export function useShows() {
  return useQuery({
    queryKey: queryKeys.shows.list(),
    queryFn: listShows,
  })
}

export function useShow(showId: string) {
  return useQuery({
    queryKey: queryKeys.shows.detail(showId),
    queryFn: () => getShow(showId),
    enabled: !!showId,
  })
}
