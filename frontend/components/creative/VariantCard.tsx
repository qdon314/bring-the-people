'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { variantsApi } from '@/lib/api/variants'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { VariantEditorModal } from './VariantEditorModal'
import type { Variant } from '@/lib/types'

const PLATFORM_LIMITS: Record<string, { hook: number; body: number; cta: number }> = {
  meta:      { hook: 80,  body: 500, cta: 60 },
  instagram: { hook: 80,  body: 300, cta: 60 },
  tiktok:    { hook: 100, body: 300, cta: 60 },
  reddit:    { hook: 300, body: 1000, cta: 80 },
  email:     { hook: 200, body: 2000, cta: 80 },
}

export function VariantCard({ variant, onReviewed }: { variant: Variant; onReviewed: () => void }) {
  const [editOpen, setEditOpen] = useState(false)
  const limits = PLATFORM_LIMITS[variant.platform] ?? PLATFORM_LIMITS.meta

  const reviewMutation = useMutation({
    mutationFn: (action: 'approve' | 'reject') =>
      variantsApi.review(variant.variant_id, { action, reviewed_by: 'producer' }),
    onSuccess: onReviewed,
  })

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-bg px-1.5 py-0.5 rounded text-text-muted">
            {variant.variant_id.slice(0, 8)}
          </span>
          <StatusBadge status={variant.review_status} />
          {!variant.constraints_passed && (
            <span className="text-xs text-danger">⚠ Constraints</span>
          )}
        </div>
        <button
          onClick={() => setEditOpen(true)}
          className="text-xs text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
        >
          Edit
        </button>
      </div>

      {/* Copy sections */}
      <div className="space-y-3 mb-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-text-muted uppercase">Hook</span>
            <span className={`text-xs ${variant.hook.length > limits.hook ? 'text-danger' : 'text-text-muted'}`}>
              {variant.hook.length}/{limits.hook}
            </span>
          </div>
          <p className="text-sm font-medium">{variant.hook}</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-text-muted uppercase">Body</span>
            <span className={`text-xs ${variant.body.length > limits.body ? 'text-danger' : 'text-text-muted'}`}>
              {variant.body.length}/{limits.body}
            </span>
          </div>
          <p className="text-sm text-text-muted whitespace-pre-wrap">{variant.body}</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-text-muted uppercase">CTA</span>
            <span className={`text-xs ${variant.cta.length > limits.cta ? 'text-danger' : 'text-text-muted'}`}>
              {variant.cta.length}/{limits.cta}
            </span>
          </div>
          <p className="text-sm font-medium text-primary">{variant.cta}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {variant.review_status !== 'approved' ? (
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
      </div>

      {reviewMutation.error && (
        <p className="text-xs text-danger mt-2">{reviewMutation.error.message}</p>
      )}

      <VariantEditorModal
        key={variant.variant_id}
        variant={variant}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={onReviewed}
      />
    </div>
  )
}
