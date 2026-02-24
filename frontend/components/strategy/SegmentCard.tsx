'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { segmentsApi } from '@/lib/api/segments'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { SegmentEditorModal } from './SegmentEditorModal'
import type { Segment } from '@/lib/types'

interface SegmentCardProps {
  segment: Segment
  onReviewed: () => void
}

export function SegmentCard({ segment, onReviewed }: SegmentCardProps) {
  const [editOpen, setEditOpen] = useState(false)

  const reviewMutation = useMutation({
    mutationFn: (action: 'approve' | 'reject') =>
      segmentsApi.review(segment.segment_id, { action, reviewed_by: 'producer' }),
    onSuccess: onReviewed,
  })

  const def = segment.definition_json as Record<string, unknown>
  const geo = def.geo as string | undefined
  const ageRange = def.age_range as string | undefined
  const interests = def.interests as string[] | undefined

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold">{segment.name}</h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 rounded bg-bg text-text-muted font-medium">
              {segment.created_by === 'agent' ? '🤖 Agent' : '✏️ Human'}
            </span>
            <StatusBadge status={segment.review_status} />
          </div>
        </div>
        <button
          onClick={() => setEditOpen(true)}
          className="text-xs text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
        >
          Edit
        </button>
      </div>

      {/* Definition summary */}
      <div className="text-sm text-text-muted space-y-1 mb-4">
        {geo && <p>📍 {geo}</p>}
        {ageRange && <p>👥 Age {ageRange}</p>}
        {interests && Array.isArray(interests) && (
          <p>🎯 {interests.slice(0, 3).join(', ')}</p>
        )}
        {segment.estimated_size && (
          <p>~{segment.estimated_size.toLocaleString()} people</p>
        )}
      </div>

      {/* Actions */}
      {segment.review_status !== 'approved' && (
        <div className="flex gap-2">
          <button
            onClick={() => reviewMutation.mutate('approve')}
            disabled={reviewMutation.isPending}
            className="flex-1 bg-success text-white text-sm py-1.5 rounded-lg font-medium hover:bg-success/90 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2"
          >
            Approve
          </button>
          <button
            onClick={() => reviewMutation.mutate('reject')}
            disabled={reviewMutation.isPending}
            className="flex-1 px-4 py-2 border border-border text-text rounded-lg text-sm font-medium hover:bg-bg transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2"
          >
            Reject
          </button>
        </div>
      )}
      {segment.review_status === 'approved' && (
        <button
          onClick={() => reviewMutation.mutate('reject')}
          className="text-xs text-text-muted hover:text-danger focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 rounded"
        >
          Undo approval
        </button>
      )}

      {reviewMutation.error && (
        <p className="text-xs text-danger mt-2">{reviewMutation.error.message}</p>
      )}

      {/* key forces state reset when segment changes */}
      <SegmentEditorModal
        key={segment.segment_id}
        segment={segment}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={onReviewed}
      />
    </div>
  )
}
