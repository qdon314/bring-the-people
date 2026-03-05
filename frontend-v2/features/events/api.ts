import { apiClient } from '@/shared/api/client'
import type { components } from '@/shared/api/generated/schema'

export type EventResponse = components['schemas']['EventResponse']

export async function listEvents(showId: string, cycleId?: string): Promise<EventResponse[]> {
  return apiClient.get('/api/events', {
    query: { show_id: showId, cycle_id: cycleId },
  }) as Promise<EventResponse[]>
}
