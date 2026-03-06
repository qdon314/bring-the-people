import { apiClient } from '@/shared/api/client'

export interface RunCreativeResponse {
  job_id: string
  status: string
}

export async function runCreative(frameId: string): Promise<RunCreativeResponse> {
  return apiClient.post('/api/creative/{frame_id}/run', {
    path: { frame_id: frameId },
  }) as Promise<RunCreativeResponse>
}
