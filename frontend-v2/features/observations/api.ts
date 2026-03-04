import { apiClient } from '@/shared/api/client'
import type { components } from '@/shared/api/generated/schema'

export type ObservationResponse = components['schemas']['ObservationResponse']

export async function listObservations(experimentId: string): Promise<ObservationResponse[]> {
  return apiClient.get('/api/observations', {
    query: { experiment_id: experimentId },
  }) as Promise<ObservationResponse[]>
}
