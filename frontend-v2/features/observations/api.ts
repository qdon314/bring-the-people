import { apiClient } from '@/shared/api/client'
import type { components } from '@/shared/api/generated/schema'

export type ObservationResponse = components['schemas']['ObservationResponse']
export type ObservationCreate = components['schemas']['ObservationCreate']

export async function listObservations(runId: string): Promise<ObservationResponse[]> {
  return apiClient.get('/api/observations', {
    query: { run_id: runId },
  }) as Promise<ObservationResponse[]>
}

export async function createObservation(body: ObservationCreate): Promise<ObservationResponse> {
  return apiClient.post('/api/observations', { body }) as Promise<ObservationResponse>
}

export async function createObservationsBulk(body: { observations: ObservationCreate[] }): Promise<ObservationResponse[]> {
  return apiClient.post('/api/observations/bulk', { body }) as Promise<ObservationResponse[]>
}
