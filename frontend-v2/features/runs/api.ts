import { apiClient } from '@/shared/api/client'
import type { components } from '@/shared/api/generated/schema'

export type RunResponse = components['schemas']['RunResponse']
export type RunCreate = components['schemas']['RunCreate']
export type RunMetricsResponse = components['schemas']['RunMetricsResponse']

export async function listRunsByCycle(cycleId: string): Promise<RunResponse[]> {
  return apiClient.get('/api/runs', {
    query: { cycle_id: cycleId },
  }) as Promise<RunResponse[]>
}

export async function listRunsByExperiment(experimentId: string): Promise<RunResponse[]> {
  return apiClient.get('/api/runs', {
    query: { experiment_id: experimentId },
  }) as Promise<RunResponse[]>
}

export async function getRun(runId: string): Promise<RunResponse> {
  return apiClient.get('/api/runs/{run_id}', {
    path: { run_id: runId },
  }) as Promise<RunResponse>
}

export async function createRun(body: RunCreate): Promise<RunResponse> {
  return apiClient.post('/api/runs', {
    body,
  }) as Promise<RunResponse>
}

export async function launchRun(runId: string): Promise<RunResponse> {
  return apiClient.post('/api/runs/{run_id}/launch', {
    path: { run_id: runId },
  }) as Promise<RunResponse>
}

export async function requestRunReapproval(runId: string): Promise<RunResponse> {
  return apiClient.post('/api/runs/{run_id}/request-reapproval', {
    path: { run_id: runId },
  }) as Promise<RunResponse>
}
