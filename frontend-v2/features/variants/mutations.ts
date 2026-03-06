'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/shared/api/client'
import { queryKeys } from '@/shared/queryKeys'
import { reviewVariant, updateVariant } from './api'
import type { VariantResponse, VariantUpdate } from './api'

interface ReviewVariables {
  variantId: string
  notes?: string
}

interface UpdateVariables {
  variantId: string
  body: VariantUpdate
}

/**
 * Approve a variant.
 * Invalidates the variant list for the frame on success.
 */
export function useApproveVariant(frameId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ variantId }: ReviewVariables) =>
      reviewVariant(variantId, 'approve'),

    onMutate: async ({ variantId }) => {
      const queryKey = queryKeys.variants.byFrame(frameId)
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<VariantResponse[]>(queryKey)

      queryClient.setQueryData<VariantResponse[]>(queryKey, (old) =>
        old?.map((v) =>
          v.variant_id === variantId
            ? { ...v, review_status: 'approved' as const }
            : v
        )
      )

      return { previous, queryKey }
    },

    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previous)
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.variants.byFrame(frameId) })
    },
  })
}

/**
 * Reject a variant, optionally with notes.
 * Invalidates the variant list for the frame on success.
 */
export function useRejectVariant(frameId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ variantId, notes }: ReviewVariables) =>
      reviewVariant(variantId, 'reject', notes),

    onMutate: async ({ variantId }) => {
      const queryKey = queryKeys.variants.byFrame(frameId)
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<VariantResponse[]>(queryKey)

      queryClient.setQueryData<VariantResponse[]>(queryKey, (old) =>
        old?.map((v) =>
          v.variant_id === variantId
            ? { ...v, review_status: 'rejected' as const }
            : v
        )
      )

      return { previous, queryKey }
    },

    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previous)
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.variants.byFrame(frameId) })
    },
  })
}

/**
 * Undo a variant review (set back to pending).
 * Uses action: 'undo' — same pattern as segments, cast as any to bypass schema enum.
 * Invalidates the variant list for the frame on success.
 */
export function useUndoVariantReview(frameId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ variantId }: ReviewVariables) =>
      apiClient.post('/api/variants/{variant_id}/review', {
        path: { variant_id: variantId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: { action: 'undo', notes: '', reviewed_by: 'producer' } as any,
      }),

    onMutate: async ({ variantId }) => {
      const queryKey = queryKeys.variants.byFrame(frameId)
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<VariantResponse[]>(queryKey)

      queryClient.setQueryData<VariantResponse[]>(queryKey, (old) =>
        old?.map((v) =>
          v.variant_id === variantId
            ? { ...v, review_status: 'pending' as const }
            : v
        )
      )

      return { previous, queryKey }
    },

    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previous)
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.variants.byFrame(frameId) })
    },
  })
}

/**
 * Update editable fields on a variant (hook, body, cta).
 * Invalidates the variant list for the frame on success.
 */
export function useUpdateVariant(frameId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ variantId, body }: UpdateVariables) =>
      updateVariant(variantId, body),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.variants.byFrame(frameId) })
    },
  })
}
