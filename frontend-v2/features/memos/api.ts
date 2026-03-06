import { apiClient } from '@/shared/api/client'
import type { components } from '@/shared/api/generated/schema'

export type MemoResponse = components['schemas']['MemoResponse']

export interface RunMemoResponse {
  job_id: string
  status: string
}

export async function listMemos(showId: string): Promise<MemoResponse[]> {
  return apiClient.get('/api/memos', {
    query: { show_id: showId },
  }) as Promise<MemoResponse[]>
}

export async function getMemo(memoId: string): Promise<MemoResponse> {
  return apiClient.get('/api/memos/{memo_id}', {
    path: { memo_id: memoId },
  }) as Promise<MemoResponse>
}

export async function runMemo(
  showId: string,
  cycleStart: string,
  cycleEnd: string
): Promise<RunMemoResponse> {
  return apiClient.post('/api/memos/{show_id}/run', {
    path: { show_id: showId },
    query: { cycle_start: cycleStart, cycle_end: cycleEnd },
  }) as Promise<RunMemoResponse>
}
