'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/queryKeys'
import { listShows, getShow, createShow } from './api'
import type { components } from '@/shared/api/generated/schema'

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

export function useCreateShow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: components['schemas']['ShowCreate']) => createShow(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shows.list() })
    },
  })
}
