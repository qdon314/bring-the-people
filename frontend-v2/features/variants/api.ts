import { apiClient } from '@/shared/api/client'
import type { components } from '@/shared/api/generated/schema'

export type VariantResponse = components['schemas']['VariantResponse']

export async function listVariants(frameId: string): Promise<VariantResponse[]> {
  return apiClient.get('/api/variants', {
    query: { frame_id: frameId },
  }) as Promise<VariantResponse[]>
}
