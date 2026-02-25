import { client } from './client'
import type { DomainEvent } from '../types'

export const eventsApi = {
  list: (showId: string, cycleId?: string, limit = 50) => {
    let params = `?show_id=${showId}&limit=${limit}`
    if (cycleId) params += `&cycle_id=${cycleId}`
    return client.get<DomainEvent[]>(`/api/events${params}`)
  },
}
