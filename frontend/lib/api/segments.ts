import { client } from './client'
import type { Segment } from '../types'

export const segmentsApi = {
  list: (showId: string, cycleId?: string) => {
    const params = cycleId ? `&cycle_id=${cycleId}` : ''
    return client.get<Segment[]>(`/api/segments?show_id=${showId}${params}`)
  },
  get: (id: string) => client.get<Segment>(`/api/segments/${id}`),
  review: (id: string, body: { action: 'approve' | 'reject'; reviewed_by: string }) =>
    client.post<Segment>(`/api/segments/${id}/review`, body),
  update: (id: string, body: { name: string; definition_json: object }) =>
    client.patch<Segment>(`/api/segments/${id}`, body),
}
