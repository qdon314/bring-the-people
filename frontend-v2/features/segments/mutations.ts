'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/shared/api/client'
import { queryKeys } from '@/shared/queryKeys'
import type { SegmentResponse } from './api'

interface ReviewVariables {
  segmentId: string
  notes?: string
}

interface UpdateVariables {
  segmentId: string
  name?: string
  estimatedSize?: number | null
  definitionJson?: Record<string, unknown>
}

/**
 * Update editable fields on a pending segment.
 * Invalidates the segment list on success.
 */
export function useUpdateSegment(showId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ segmentId, name, estimatedSize, definitionJson }: UpdateVariables) => {
      const body: Record<string, unknown> = {}
      if (name !== undefined) body.name = name
      if (estimatedSize !== undefined) body.estimated_size = estimatedSize
      if (definitionJson !== undefined) body.definition_json = definitionJson
      return apiClient.patch('/api/segments/{segment_id}', {
        path: { segment_id: segmentId },
        body,
      })
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.segments.list(showId) })
    },
  })
}

/**
 * Approve a segment with optimistic update.
 * Reverts cache on error.
 */
export function useApproveSegment(showId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ segmentId }: ReviewVariables) =>
      apiClient.post('/api/segments/{segment_id}/review', {
        path: { segment_id: segmentId },
        body: { action: 'approve', notes: '', reviewed_by: 'producer' },
      }),

    onMutate: async ({ segmentId }) => {
      const queryKey = queryKeys.segments.list(showId)
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<SegmentResponse[]>(queryKey)

      queryClient.setQueryData<SegmentResponse[]>(queryKey, (old) =>
        old?.map((seg) =>
          seg.segment_id === segmentId
            ? { ...seg, review_status: 'approved' as const }
            : seg
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
      queryClient.invalidateQueries({ queryKey: queryKeys.segments.list(showId) })
    },
  })
}

/**
 * Undo a segment review (set back to pending).
 * Reverts cache on error.
 */
export function useUndoSegmentReview(showId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ segmentId }: ReviewVariables) =>
      apiClient.post('/api/segments/{segment_id}/review', {
        path: { segment_id: segmentId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: { action: 'undo', notes: '', reviewed_by: 'producer' } as any,
      }),

    onMutate: async ({ segmentId }) => {
      const queryKey = queryKeys.segments.list(showId)
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<SegmentResponse[]>(queryKey)

      queryClient.setQueryData<SegmentResponse[]>(queryKey, (old) =>
        old?.map((seg) =>
          seg.segment_id === segmentId
            ? { ...seg, review_status: 'pending' as const }
            : seg
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
      queryClient.invalidateQueries({ queryKey: queryKeys.segments.list(showId) })
    },
  })
}

export function useRejectSegment(showId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ segmentId, notes }: ReviewVariables) =>
      apiClient.post('/api/segments/{segment_id}/review', {
        path: { segment_id: segmentId },
        body: { action: 'reject', notes: notes ?? '', reviewed_by: 'producer' },
      }),

    onMutate: async ({ segmentId }) => {
      const queryKey = queryKeys.segments.list(showId)
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<SegmentResponse[]>(queryKey)

      queryClient.setQueryData<SegmentResponse[]>(queryKey, (old) =>
        old?.map((seg) =>
          seg.segment_id === segmentId
            ? { ...seg, review_status: 'rejected' as const }
            : seg
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
      queryClient.invalidateQueries({ queryKey: queryKeys.segments.list(showId) })
    },
  })
}
