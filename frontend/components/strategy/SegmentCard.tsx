'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
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
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null)

  const reviewMutation = useMutation({
    mutationFn: (action: 'approve' | 'reject') =>
      segmentsApi.review(segment.segment_id, { action, reviewed_by: 'producer' }),
    onSuccess: (_data, action) => {
      toast.success(action === 'approve' ? 'Segment approved' : 'Segment rejected')
      onReviewed()
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => setPendingAction(null),
  })

  const def = segment.definition_json as Record<string, unknown>
  const geo = def.geo as { city?: string; radius_miles?: number } | undefined
  const ageRange = def.age_range as string | undefined
  const interests = def.interests as string[] | undefined

  const isApproved = segment.review_status === 'approved'
  const isRejected = segment.review_status === 'rejected'

  return (
    <div className={`relative bg-surface border rounded-lg p-5 transition-colors ${
      isApproved 
        ? 'border-success/40 bg-success/5 shadow-sm' 
        : isRejected 
          ? 'border-danger/40 bg-danger/5' 
          : 'border-border'
    }`}>
      {/* Approval indicator strip */}
      <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r ${
        isApproved ? 'bg-success' : isRejected ? 'bg-danger' : 'bg-transparent'
      }`} />
      
      {/* Header */}
      <div className="flex items-start justify-between mb-3 pl-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold">{segment.name}</h4>
            {isApproved && (
              <span className="text-success text-lg" title="Approved" aria-label="Approved">✓</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded bg-bg text-text-muted font-medium">
              {segment.created_by === 'agent' ? '🤖 Agent-generated' : '✏️ Edited by you'}
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
      <div className="pl-2 text-sm text-text-muted space-y-1 mb-4">
        {geo && geo.city && (
          <p>
            📍 {geo.city}
            {geo.radius_miles !== undefined && ` (${geo.radius_miles} mi)`}
          </p>
        )}
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
        <div className="pl-2 flex gap-2">
          <button
            onClick={() => {
              setPendingAction('approve')
              reviewMutation.mutate('approve')
            }}
            disabled={reviewMutation.isPending}
            className="flex-1 bg-success text-white text-sm py-1.5 rounded-lg font-medium hover:bg-success/90 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2"
          >
            {pendingAction === 'approve' ? 'Approving…' : '✓ Approve'}
          </button>
          <button
            onClick={() => {
              if (window.confirm('Reject this segment? It will be hidden from experiments.')) {
                setPendingAction('reject')
                reviewMutation.mutate('reject')
              }
            }}
            disabled={reviewMutation.isPending}
            className="flex-1 px-4 py-2 border border-border text-text rounded-lg text-sm font-medium hover:bg-bg transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2"
          >
            {pendingAction === 'reject' ? 'Rejecting…' : '✕ Reject'}
          </button>
        </div>
      )}
      {isApproved && (
        <div className="pl-2 flex items-center justify-between">
          <span className="text-sm text-success font-medium">
            ✓ Approved and ready for experiments
          </span>
          <button
            onClick={() => {
              if (window.confirm('Undo approval? This segment will return to draft status.')) {
                setPendingAction('reject')
                reviewMutation.mutate('reject')
              }
            }}
            disabled={reviewMutation.isPending}
            className="text-xs text-text-muted hover:text-danger px-2 py-1 rounded hover:bg-danger/10 transition-colors focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2"
          >
            {pendingAction === 'reject' ? 'Undoing…' : 'Undo'}
          </button>
        </div>
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
