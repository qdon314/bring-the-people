import { apiClient } from '@/shared/api/client'
import type { components } from '@/shared/api/generated/schema'

export type ExperimentResponse = components['schemas']['ExperimentResponse']

export async function listExperiments(showId: string): Promise<ExperimentResponse[]> {
  return apiClient.get('/api/experiments', {
    query: { show_id: showId },
  }) as Promise<ExperimentResponse[]>
}
