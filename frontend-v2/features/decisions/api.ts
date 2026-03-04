import { apiClient } from '@/shared/api/client'
import type { components } from '@/shared/api/generated/schema'

export type DecisionResponse = components['schemas']['DecisionResponse']

export async function listDecisions(experimentId: string): Promise<DecisionResponse[]> {
  return apiClient.get('/api/decisions', {
    query: { experiment_id: experimentId },
  }) as Promise<DecisionResponse[]>
}
