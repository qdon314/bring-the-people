import { useQuery } from '@tanstack/react-query'
import { framesApi } from '../api/frames'

export function useFrames(showId: string, cycleId?: string, segmentId?: string) {
  return useQuery({
    queryKey: ['frames', showId, cycleId, segmentId],
    queryFn: () => framesApi.list(showId, cycleId, segmentId),
    enabled: !!showId,
  })
}

export function useFrame(frameId: string) {
  return useQuery({
    queryKey: ['frames', frameId],
    queryFn: () => framesApi.get(frameId),
    enabled: !!frameId,
  })
}
