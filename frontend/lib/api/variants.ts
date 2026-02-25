import { client } from './client'
import type { Variant } from '../types'

export const variantsApi = {
  list: (frameId: string) => client.get<Variant[]>(`/api/variants?frame_id=${frameId}`),
  get: (id: string) => client.get<Variant>(`/api/variants/${id}`),
  review: (id: string, body: { action: 'approve' | 'reject'; reviewed_by: string }) =>
    client.post<Variant>(`/api/variants/${id}/review`, body),
  update: (id: string, body: { hook: string; body: string; cta: string }) =>
    client.patch<Variant>(`/api/variants/${id}`, body),
}
