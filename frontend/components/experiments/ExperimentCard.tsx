'use client'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { experimentsApi } from '@/lib/api/experiments'
import { useExperimentMetrics } from '@/lib/hooks/useExperiments'
import { ChannelBadge } from '@/components/shared/ChannelBadge'
import { UTMPreview } from './UTMPreview'
import { buildUTM, buildAdSetName } from '@/lib/utils/utm'
import { useShow } from '@/lib/hooks/useShow'
import { useState } from 'react'
import type { Experiment } from '@/lib/types'

interface Props {
  experiment: Experiment
  showId: string
  onUpdated: () => void
}

export function ExperimentCard({ experiment, showId, onUpdated }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { data: show } = useShow(showId)
  const { data: metrics } = useExperimentMetrics(experiment.experiment_id)
  const selectedVariantId =
    typeof experiment.baseline_snapshot?.selected_variant_id === 'string'
      ? experiment.baseline_snapshot.selected_variant_id
      : experiment.frame_id

  const utmBundle = show ? buildUTM({
    show,
    experimentId: experiment.experiment_id,
    variantId: selectedVariantId,
    platform: experiment.channel,
    segmentId: experiment.segment_id,
  }) : null

  const startMutation = useMutation({
    mutationFn: () => experimentsApi.start(experiment.experiment_id),
    onSuccess: () => {
      toast.success('Experiment launched')
      onUpdated()
    },
    onError: (e) => toast.error(e.message),
  })

  const stopMutation = useMutation({
    mutationFn: () => experimentsApi.stop(experiment.experiment_id),
    onSuccess: () => {
      toast.success('Experiment stopped')
      onUpdated()
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="bg-surface border border-border rounded-lg">
      {/* Row summary */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm">
                {experiment.channel} experiment
              </h4>
              <ChannelBadge channel={experiment.channel} />
            </div>
            <p className="text-xs text-text-muted font-mono">{experiment.experiment_id.slice(0, 8)}</p>
          </div>
          <ExperimentStatusBadge status={experiment.status} />
        </div>

        {/* Metrics row */}
        {metrics && (
          <div className="flex items-center gap-6 text-xs text-text-muted mb-3">
            <span>Budget: <span className="font-medium text-text">${(experiment.budget_cap_cents / 100).toFixed(0)}</span></span>
            <span>Spend: <span className="font-medium text-text">${(metrics.total_spend_cents / 100).toFixed(2)}</span></span>
            <span>Clicks: <span className="font-medium text-text">{metrics.total_clicks}</span></span>
            <span>Purchases: <span className="font-medium text-text">{metrics.total_purchases}</span></span>
            {metrics.cpa_cents && <span>CPA: <span className="font-medium text-text">${(metrics.cpa_cents / 100).toFixed(2)}</span></span>}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {experiment.status === 'approved' && (
            <button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="btn-success text-xs py-1 px-3"
            >
              {startMutation.isPending ? 'Launching…' : 'Mark Launched'}
            </button>
          )}
          {experiment.status === 'running' && (
            <button
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
              className="btn-ghost text-xs py-1 px-3"
            >
              {stopMutation.isPending ? 'Stopping…' : 'Stop'}
            </button>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-primary hover:underline ml-auto"
          >
            {expanded ? 'Hide detail ▴' : 'Show detail ▾'}
          </button>
        </div>
      </div>

      {/* Expanded: UTMs + copy pack */}
      {expanded && utmBundle && (
        <div className="border-t border-border p-5 space-y-4">
          <UTMPreview utm={utmBundle} adSetName={show ? buildAdSetName({
            show,
            platform: experiment.channel,
            segmentId: experiment.segment_id,
            experimentId: experiment.experiment_id,
          }) : ''} />
        </div>
      )}
    </div>
  )
}

function ExperimentStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-border text-text-muted',
    awaiting_approval: 'bg-warning-light text-warning',
    approved: 'bg-accent-light text-accent',
    running: 'bg-success-light text-success',
    completed: 'bg-bg text-text-muted',
    stopped: 'bg-danger-light text-danger',
    archived: 'bg-bg text-text-muted',
  }

  const labels: Record<string, string> = {
    draft: 'Draft',
    awaiting_approval: 'Awaiting Approval',
    approved: 'Approved',
    running: 'Running',
    completed: 'Completed',
    stopped: 'Stopped',
    archived: 'Archived',
  }

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? styles.draft}`}>
      {labels[status] ?? status}
    </span>
  )
}
