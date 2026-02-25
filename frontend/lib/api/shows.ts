import { client } from './client'
import type { Show } from '../types'

export const showsApi = {
  list: () => client.get<Show[]>('/api/shows'),
  get: (id: string) => client.get<Show>(`/api/shows/${id}`),
  create: (body: Omit<Show, 'show_id'>) => client.post<Show>('/api/shows', body),
  update: (id: string, body: Partial<Show>) => client.patch<Show>(`/api/shows/${id}`, body),
}
