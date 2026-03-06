'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/queryKeys'
import { listMemos, getMemo } from './api'

export function useMemos(showId: string) {
  return useQuery({
    queryKey: queryKeys.memos.list(showId),
    queryFn: () => listMemos(showId),
    enabled: !!showId,
  })
}

export function useMemo(memoId: string) {
  return useQuery({
    queryKey: queryKeys.memos.detail(memoId),
    queryFn: () => getMemo(memoId),
    enabled: !!memoId,
  })
}
