import { apiClient } from '@/shared/api/client'
import type { components } from '@/shared/api/generated/schema'

export type VariantResponse = components['schemas']['VariantResponse']
export type VariantUpdate = components['schemas']['VariantUpdate']

export async function listVariants(frameId: string): Promise<VariantResponse[]> {
  return apiClient.get('/api/variants', {
    query: { frame_id: frameId },
  }) as Promise<VariantResponse[]>
}

export async function updateVariant(variantId: string, body: VariantUpdate): Promise<VariantResponse> {
  return apiClient.patch('/api/variants/{variant_id}', {
    path: { variant_id: variantId },
    body,
  }) as Promise<VariantResponse>
}

export async function reviewVariant(
  variantId: string,
  action: 'approve' | 'reject',
  notes?: string,
): Promise<VariantResponse> {
  return apiClient.post('/api/variants/{variant_id}/review', {
    path: { variant_id: variantId },
    body: { action, notes: notes ?? '', reviewed_by: 'producer' },
  }) as Promise<VariantResponse>
}
