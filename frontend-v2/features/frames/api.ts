import { apiClient } from '@/shared/api/client'
import type { components } from '@/shared/api/generated/schema'

export type FrameResponse = components['schemas']['FrameResponse']

export async function listFrames(showId: string, cycleId?: string): Promise<FrameResponse[]> {
  return apiClient.get('/api/frames', {
    query: { show_id: showId, cycle_id: cycleId },
  }) as Promise<FrameResponse[]>
}
