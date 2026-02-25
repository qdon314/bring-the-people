import { client } from './client'
import type { Observation } from '../types'

export const observationsApi = {
  list: (experimentId: string) =>
    client.get<Observation[]>(`/api/observations?experiment_id=${experimentId}`),
  create: (body: Omit<Observation, 'observation_id'>) =>
    client.post<Observation>('/api/observations', body),
}
