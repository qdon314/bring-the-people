import { useExperimentMetrics } from '@/lib/hooks/useExperiments'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ChannelBadge } from '@/components/shared/ChannelBadge'
import type { Experiment } from '@/lib/types'

export function ActiveExperimentsPanel({ experiments, showId }: { experiments: Experiment[]; showId: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <h3 className="font-semibold">Active Experiments</h3>
        <span className="text-xs text-text-muted">{experiments.length} running</span>
      </div>
      {experiments.length === 0 ? (
        <div className="p-5 text-sm text-text-muted">No active experiments.</div>
      ) : (
        <ul className="divide-y divide-border">
          {experiments.map(exp => (
            <ExperimentRow key={exp.experiment_id} experiment={exp} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ExperimentRow({ experiment }: { experiment: Experiment }) {
  const { data: metrics } = useExperimentMetrics(experiment.experiment_id)

  return (
    <li className="p-5 hover:bg-bg/50 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">{experiment.channel} experiment</h4>
            <ChannelBadge channel={experiment.channel} />
          </div>
          <p className="text-xs text-text-muted font-mono">{experiment.experiment_id.slice(0, 12)}</p>
        </div>
        <StatusBadge status={experiment.status as 'draft' | 'approved' | 'rejected'} />
      </div>
      {metrics && (
        <div className="flex items-center gap-6 text-xs text-text-muted">
          <span>Budget: <span className="font-medium text-text">${(experiment.budget_cap_cents / 100).toFixed(0)}</span></span>
          <span>Spent: <span className="font-medium text-text">${(metrics.total_spend_cents / 100).toFixed(0)}</span></span>
          <span>Clicks: <span className="font-medium text-text">{metrics.total_clicks}</span></span>
          <span>Purchases: <span className="font-medium text-text">{metrics.total_purchases}</span></span>
        </div>
      )}
    </li>
  )
}
