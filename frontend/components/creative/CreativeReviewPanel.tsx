'use client'
import { useEffect } from 'react'
import { useJobPoller } from '@/lib/hooks/useJobPoller'
import { useVariants } from '@/lib/hooks/useVariants'
import { ChannelBadge } from '@/components/shared/ChannelBadge'
import { SpinnerIcon } from '@/components/shared/SpinnerIcon'
import { VariantCard } from './VariantCard'
import type { Frame } from '@/lib/types'

interface Props {
  frame: Frame
  jobId: string | null
  onComplete: () => void
  onReviewed: () => void
}

export function CreativeReviewPanel({ frame, jobId, onComplete, onReviewed }: Props) {
  const { data: job } = useJobPoller(jobId)
  const { data: variants } = useVariants(frame.frame_id)

  // Trigger parent refresh when job completes
  useEffect(() => {
    if (job?.status === 'completed') onComplete()
  }, [job?.status, onComplete])

  const isGenerating = job && (job.status === 'queued' || job.status === 'running')

  return (
    <section aria-labelledby={`frame-${frame.frame_id}-heading`}>
      <div className="bg-surface border border-border rounded-lg">
        {/* Frame header */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <ChannelBadge channel={frame.channel} />
            <h2 id={`frame-${frame.frame_id}-heading`} className="font-semibold">
              {frame.hypothesis.slice(0, 80)}{frame.hypothesis.length > 80 ? '…' : ''}
            </h2>
          </div>
          <p className="text-sm text-text-muted mt-1">&ldquo;{frame.promise}&rdquo;</p>
        </div>

        {/* Generation status */}
        {isGenerating && (
          <div className="p-4 flex items-center gap-3 text-sm text-accent bg-accent-light/30">
            <SpinnerIcon className="w-4 h-4 animate-spin motion-reduce:animate-none" />
            Generating variants… {job.status === 'running' ? '(running)' : '(queued)'}
          </div>
        )}

        {/* Error */}
        {job?.status === 'failed' && (
          <div className="p-4 bg-danger-light text-danger text-sm" role="alert">
            Generation failed: {job.error_message}
          </div>
        )}

        {/* Variants */}
        {variants && variants.length > 0 && (
          <div className="divide-y divide-border">
            {variants.map(variant => (
              <VariantCard key={variant.variant_id} variant={variant} onReviewed={onReviewed} />
            ))}
          </div>
        )}

        {/* Empty state after job complete */}
        {!isGenerating && job?.status !== 'failed' && !variants?.length && (
          <div className="p-5 text-sm text-text-muted">
            No variants yet. Select this frame and click Generate Creative.
          </div>
        )}
      </div>
    </section>
  )
}
