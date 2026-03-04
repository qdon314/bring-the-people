import { apiClient } from '@/shared/api/client'
import type { components } from '@/shared/api/generated/schema'

export type SegmentResponse = components['schemas']['SegmentResponse']

export async function listSegments(showId: string, cycleId?: string): Promise<SegmentResponse[]> {
  return apiClient.get('/api/segments', {
    query: { show_id: showId, cycle_id: cycleId },
  }) as Promise<SegmentResponse[]>
}
