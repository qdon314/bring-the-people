import { client } from './client'
import type { Experiment, ExperimentMetrics } from '../types'

export const experimentsApi = {
  list: (showId: string) => client.get<Experiment[]>(`/api/experiments?show_id=${showId}`),
  get: (id: string) => client.get<Experiment>(`/api/experiments/${id}`),
  create: (body: Omit<Experiment, 'experiment_id' | 'status' | 'start_time' | 'end_time'>) =>
    client.post<Experiment>('/api/experiments', body),
  submit: (id: string) => client.post<Experiment>(`/api/experiments/${id}/submit`, {}),
  approve: (id: string, approved: boolean, notes = '') =>
    client.post<Experiment>(`/api/experiments/${id}/approve`, { approved, notes }),
  start: (id: string) => client.post<Experiment>(`/api/experiments/${id}/start`, {}),
  complete: (id: string) => client.post<Experiment>(`/api/experiments/${id}/complete`, {}),
  stop: (id: string) => client.post<Experiment>(`/api/experiments/${id}/stop`, {}),
  metrics: (id: string) => client.get<ExperimentMetrics>(`/api/experiments/${id}/metrics`),
}
