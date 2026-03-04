'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/queryKeys'
import { listMemos } from './api'

export function useMemos(showId: string) {
  return useQuery({
    queryKey: queryKeys.memos.list(showId),
    queryFn: () => listMemos(showId),
    enabled: !!showId,
  })
}
