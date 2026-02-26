'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
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

function formatEvidence(ref: Record<string, unknown>): string {
  const source = ref.source as string | undefined
  const type = ref.type as string | undefined
  const description = ref.description as string | undefined
  
  // Show data citations
  if (source === 'show_data' || type === 'show_data') {
    const field = ref.field as string | undefined
    const value = ref.value as string | number | undefined
    if (field) {
      return `📊 Show data: ${field}${value !== undefined ? ` (${value})` : ''}`
    }
  }
  
  // Segment insights
  if (source === 'segment_insight' || type === 'segment_insight') {
    return `🎯 Segment insight: ${description || ref.insight || 'Audience analysis'}`
  }
  
  // Historical performance
  if (source === 'historical' || type === 'historical_performance') {
    const metric = ref.metric as string | undefined
    const comparison = ref.comparison as string | undefined
    return `📈 Historical: ${metric || 'Performance'} ${comparison || 'analysis'}`
  }
  
  // Market/industry data
  if (source === 'market' || type === 'market_data') {
    return `🏢 Market data: ${description || ref.trend || 'Industry trend'}`
  }
  
  // Geographic data
  if (source === 'geo' || type === 'geographic') {
    const location = ref.location || ref.city || ref.region
    return `📍 Location: ${location || 'Geographic analysis'}`
  }
  
  // Fallback: use description if available
  if (description) {
    return `• ${description}`
  }
  
  // Last resort: stringify
  try {
    return JSON.stringify(ref)
  } catch {
    return 'Unknown citation'
  }
}

export function FrameCard({ frame, onReviewed }: FrameCardProps) {
  const { show_id } = useParams<{ show_id: string }>()
  const [editOpen, setEditOpen] = useState(false)
  const [showEvidence, setShowEvidence] = useState(false)
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null)

  const reviewMutation = useMutation({
    mutationFn: (action: 'approve' | 'reject') =>
      framesApi.review(frame.frame_id, { action, reviewed_by: 'producer' }),
    onSuccess: (_data, action) => {
      toast.success(action === 'approve' ? 'Frame approved' : 'Frame rejected')
      onReviewed()
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => setPendingAction(null),
  })

  const isApproved = frame.review_status === 'approved'
  const isRejected = frame.review_status === 'rejected'

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
        <div className="flex-1 mr-3">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <ChannelBadge channel={frame.channel} />
            <StatusBadge status={frame.review_status} />
            {isApproved && (
              <span className="text-success text-lg" title="Approved" aria-label="Approved">✓</span>
            )}
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
      <blockquote className="pl-2 text-sm text-text-muted italic border-l-2 border-primary/30 mb-3">
        &ldquo;{frame.promise}&rdquo;
      </blockquote>

      {/* Evidence refs (collapsible) */}
      {frame.evidence_refs.length > 0 && (
        <div className="pl-2 mb-3">
          <button
            onClick={() => setShowEvidence(v => !v)}
            className="text-xs text-text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
          >
            {showEvidence ? '▾ Hide' : '▸ View'} reasoning ({frame.evidence_refs.length} source{frame.evidence_refs.length !== 1 ? 's' : ''})
          </button>
          {showEvidence && (
            <ul className="mt-2 space-y-1">
              {frame.evidence_refs.map((ref, i) => (
                <li key={i} className="text-xs text-text-muted bg-bg rounded px-2 py-1">
                  {formatEvidence(ref as Record<string, unknown>)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Risk notes */}
      {frame.risk_notes && (
        <p className="pl-2 text-xs text-warning mb-3">⚠️ {frame.risk_notes}</p>
      )}

      {/* Actions */}
      <div className="pl-2 flex items-center gap-2">
        {frame.review_status !== 'approved' ? (
          <>
            <button
              onClick={() => {
                setPendingAction('approve')
                reviewMutation.mutate('approve')
              }}
              disabled={reviewMutation.isPending}
              className="bg-success text-white text-xs py-1 px-3 rounded font-medium hover:bg-success/90 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2"
            >
              {pendingAction === 'approve' ? 'Approving…' : '✓ Approve'}
            </button>
            <button
              onClick={() => {
                if (window.confirm('Reject this frame? It will be hidden from experiments.')) {
                  setPendingAction('reject')
                  reviewMutation.mutate('reject')
                }
              }}
              disabled={reviewMutation.isPending}
              className="px-3 py-1 border border-border text-text rounded text-xs font-medium hover:bg-bg transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2"
            >
              {pendingAction === 'reject' ? 'Rejecting…' : '✕ Reject'}
            </button>
          </>
        ) : (
          <div className="flex items-center justify-between w-full">
            <span className="text-sm text-success font-medium">
              ✓ Approved and ready for experiments
            </span>
            <button
              onClick={() => {
                if (window.confirm('Undo approval? This frame will return to draft status.')) {
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
