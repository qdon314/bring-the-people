import { apiClient } from '@/shared/api/client'
import type { components } from '@/shared/api/generated/schema'

export type MemoResponse = components['schemas']['MemoResponse']

export async function listMemos(showId: string): Promise<MemoResponse[]> {
  return apiClient.get('/api/memos', {
    query: { show_id: showId },
  }) as Promise<MemoResponse[]>
}
