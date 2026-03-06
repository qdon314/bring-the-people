'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient, ApiError } from '@/shared/api/client'
import { queryKeys } from '@/shared/queryKeys'
import type { FrameResponse } from './api'

interface UpdateFrameVariables {
  frameId: string
  hypothesis: string
  promise: string
  channel: string
  evidenceRefs?: Array<Record<string, unknown>>
  riskNotes?: string
}

export function useUpdateFrame(showId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ frameId, hypothesis, promise, channel, evidenceRefs, riskNotes }: UpdateFrameVariables) =>
      apiClient.patch('/api/frames/{frame_id}', {
        path: { frame_id: frameId },
        body: {
          hypothesis,
          promise,
          channel,
          evidence_refs: evidenceRefs,
          risk_notes: riskNotes,
        },
      }),

    onMutate: async ({ frameId, ...updates }) => {
      const queryKey = queryKeys.frames.list(showId)
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<FrameResponse[]>(queryKey)

      queryClient.setQueryData<FrameResponse[]>(queryKey, (old) =>
        old?.map((frame) =>
          frame.frame_id === frameId ? { ...frame, ...updates } : frame
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
      queryClient.invalidateQueries({ queryKey: queryKeys.frames.list(showId) })
    },
  })
}

interface ReviewVariables {
  frameId: string
  notes?: string
}

export function useApproveFrame(showId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ frameId }: ReviewVariables) =>
      apiClient.post('/api/frames/{frame_id}/review', {
        path: { frame_id: frameId },
        body: { action: 'approve', notes: '', reviewed_by: 'producer' },
      }),

    onMutate: async ({ frameId }) => {
      const queryKey = queryKeys.frames.list(showId)
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<FrameResponse[]>(queryKey)

      queryClient.setQueryData<FrameResponse[]>(queryKey, (old) =>
        old?.map((frame) =>
          frame.frame_id === frameId
            ? { ...frame, review_status: 'approved' as const }
            : frame
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
      queryClient.invalidateQueries({ queryKey: queryKeys.frames.list(showId) })
    },
  })
}

export function useUndoFrameReview(showId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ frameId }: ReviewVariables) =>
      apiClient.post('/api/frames/{frame_id}/review', {
        path: { frame_id: frameId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: { action: 'undo', notes: '', reviewed_by: 'producer' } as any,
      }),

    onMutate: async ({ frameId }) => {
      const queryKey = queryKeys.frames.list(showId)
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<FrameResponse[]>(queryKey)

      queryClient.setQueryData<FrameResponse[]>(queryKey, (old) =>
        old?.map((frame) =>
          frame.frame_id === frameId
            ? { ...frame, review_status: 'pending' as const }
            : frame
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
      queryClient.invalidateQueries({ queryKey: queryKeys.frames.list(showId) })
    },
  })
}

export function useRejectFrame(showId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ frameId, notes }: ReviewVariables) =>
      apiClient.post('/api/frames/{frame_id}/review', {
        path: { frame_id: frameId },
        body: { action: 'reject', notes: notes ?? '', reviewed_by: 'producer' },
      }),

    onMutate: async ({ frameId }) => {
      const queryKey = queryKeys.frames.list(showId)
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<FrameResponse[]>(queryKey)

      queryClient.setQueryData<FrameResponse[]>(queryKey, (old) =>
        old?.map((frame) =>
          frame.frame_id === frameId
            ? { ...frame, review_status: 'rejected' as const }
            : frame
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
      queryClient.invalidateQueries({ queryKey: queryKeys.frames.list(showId) })
    },
  })
}
