import { useQuery } from '@tanstack/react-query'
import { memosApi } from '../api/memos'

export function useMemos(showId: string) {
  return useQuery({
    queryKey: ['memos', showId],
    queryFn: () => memosApi.list(showId),
    enabled: !!showId,
  })
}

export function useMemo(memoId: string) {
  return useQuery({
    queryKey: ['memos', memoId],
    queryFn: () => memosApi.get(memoId),
    enabled: !!memoId,
  })
}
