import { apiClient } from '@/shared/api/client'
import type { components } from '@/shared/api/generated/schema'

export type DecisionResponse = components['schemas']['DecisionResponse']

export async function listDecisions(runId: string): Promise<DecisionResponse[]> {
  return apiClient.get('/api/decisions', {
    query: { run_id: runId },
  }) as Promise<DecisionResponse[]>
}

export async function evaluateRun(runId: string): Promise<DecisionResponse> {
  return apiClient.post('/api/decisions/evaluate/{run_id}', {
    path: { run_id: runId },
  }) as Promise<DecisionResponse>
}
