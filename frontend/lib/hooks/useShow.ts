import { useQuery } from '@tanstack/react-query'
import { showsApi } from '../api/shows'

export function useShow(showId: string) {
  return useQuery({
    queryKey: ['shows', showId],
    queryFn: () => showsApi.get(showId),
    enabled: !!showId,
  })
}

export function useShows() {
  return useQuery({
    queryKey: ['shows'],
    queryFn: showsApi.list,
  })
}
