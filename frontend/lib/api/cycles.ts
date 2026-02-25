import { client } from './client'
import type { Cycle } from '../types'

export const cyclesApi = {
  list: (showId: string) => client.get<Cycle[]>(`/api/shows/${showId}/cycles`),
  get: (cycleId: string) => client.get<Cycle>(`/api/cycles/${cycleId}`),
}
