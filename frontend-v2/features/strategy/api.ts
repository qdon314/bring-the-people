import { apiClient } from '@/shared/api/client'

export interface RunStrategyResponse {
  job_id: string
  status: string
}

export async function runStrategy(showId: string, cycleId: string): Promise<RunStrategyResponse> {
  return apiClient.post('/api/strategy/{show_id}/run', {
    path: { show_id: showId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: { cycle_id: cycleId } as any,
  }) as Promise<RunStrategyResponse>
}
