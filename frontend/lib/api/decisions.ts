import { client } from './client'
import type { Decision } from '../types'

export const decisionsApi = {
  list: (experimentId: string) =>
    client.get<Decision[]>(`/api/decisions?experiment_id=${experimentId}`),
  evaluate: (experimentId: string) =>
    client.post<Decision>(`/api/decisions/evaluate`, { experiment_id: experimentId }),
}
