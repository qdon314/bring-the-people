'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { framesApi } from '@/lib/api/frames'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ChannelBadge } from '@/components/shared/ChannelBadge'
import { FrameEditorModal } from './FrameEditorModal'
import type { Frame } from '@/lib/types'

interface FrameCardProps {
  frame: Frame
  onReviewed: () => void
}

export function FrameCard({ frame, onReviewed }: FrameCardProps) {
  const { show_id } = useParams<{ show_id: string }>()
  const [editOpen, setEditOpen] = useState(false)
  const [showEvidence, setShowEvidence] = useState(false)

  const reviewMutation = useMutation({
    mutationFn: (action: 'approve' | 'reject') =>
      framesApi.review(frame.frame_id, { action, reviewed_by: 'producer' }),
    onSuccess: onReviewed,
  })

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 mr-3">
          <div className="flex items-center gap-2 mb-1">
            <ChannelBadge channel={frame.channel} />
            <StatusBadge status={frame.review_status} />
          </div>
          <p className="font-semibold text-sm leading-snug">{frame.hypothesis}</p>
        </div>
        <button
          onClick={() => setEditOpen(true)}
          className="text-xs text-primary hover:underline shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
        >
          Edit
        </button>
      </div>

      {/* Promise */}
      <blockquote className="text-sm text-text-muted italic border-l-2 border-primary/30 pl-3 mb-3">
        &ldquo;{frame.promise}&rdquo;
      </blockquote>

      {/* Evidence refs (collapsible) */}
      {frame.evidence_refs.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setShowEvidence(v => !v)}
            className="text-xs text-text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
          >
            {showEvidence ? '▾' : '▸'} {frame.evidence_refs.length} evidence ref{frame.evidence_refs.length !== 1 ? 's' : ''}
          </button>
          {showEvidence && (
            <ul className="mt-2 space-y-1">
              {frame.evidence_refs.map((ref, i) => (
                <li key={i} className="text-xs text-text-muted bg-bg rounded px-2 py-1">
                  {String((ref as Record<string, unknown>).source ?? (ref as Record<string, unknown>).description ?? JSON.stringify(ref))}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Risk notes */}
      {frame.risk_notes && (
        <p className="text-xs text-warning mb-3">⚠️ {frame.risk_notes}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {frame.review_status !== 'approved' ? (
          <>
            <button
              onClick={() => reviewMutation.mutate('approve')}
              disabled={reviewMutation.isPending}
              className="bg-success text-white text-xs py-1 px-3 rounded font-medium hover:bg-success/90 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2"
            >
              Approve
            </button>
            <button
              onClick={() => reviewMutation.mutate('reject')}
              disabled={reviewMutation.isPending}
              className="px-3 py-1 border border-border text-text rounded text-xs font-medium hover:bg-bg transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2"
            >
              Reject
            </button>
          </>
        ) : (
          <button
            onClick={() => reviewMutation.mutate('reject')}
            className="text-xs text-text-muted hover:text-danger focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 rounded"
          >
            Undo approval
          </button>
        )}
        <Link
          href={`/shows/${show_id}/create?frame_id=${frame.frame_id}`}
          className="ml-auto text-xs text-primary font-medium hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
        >
          Generate Creative →
        </Link>
      </div>

      {/* key forces state reset when frame changes */}
      <FrameEditorModal key={frame.frame_id} frame={frame} open={editOpen} onClose={() => setEditOpen(false)} onSaved={onReviewed} />
    </div>
  )
}
