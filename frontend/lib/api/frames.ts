import { client } from './client'
import type { Frame } from '../types'

export const framesApi = {
  list: (showId: string, cycleId?: string, segmentId?: string) => {
    let params = `?show_id=${showId}`
    if (cycleId) params += `&cycle_id=${cycleId}`
    if (segmentId) params += `&segment_id=${segmentId}`
    return client.get<Frame[]>(`/api/frames${params}`)
  },
  get: (id: string) => client.get<Frame>(`/api/frames/${id}`),
  review: (id: string, body: { action: 'approve' | 'reject'; reviewed_by: string }) =>
    client.post<Frame>(`/api/frames/${id}/review`, body),
  update: (id: string, body: { hypothesis: string; promise: string; channel: string; risk_notes: string | null }) =>
    client.patch<Frame>(`/api/frames/${id}`, body),
}
