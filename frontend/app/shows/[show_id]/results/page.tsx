'use client'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useExperiments, useExperimentMetrics } from '@/lib/hooks/useExperiments'
import { useDecisions } from '@/lib/hooks/useDecisions'
import { useCycles } from '@/lib/hooks/useCycles'
import { ResultsEntryForm } from '@/components/results/ResultsEntryForm'
import { DecisionBadge } from '@/components/results/DecisionBadge'
import { decisionsApi } from '@/lib/api/decisions'
import { useMutation } from '@tanstack/react-query'
import type { Experiment, ExperimentMetrics } from '@/lib/types'

export default function ResultsPage() {
  const { show_id } = useParams<{ show_id: string }>()
  const qc = useQueryClient()
  const { data: cycles } = useCycles(show_id)
  const currentCycleId = cycles?.[0]?.cycle_id
  const { data: experiments } = useExperiments(show_id)
  const cycleExperiments = experiments?.filter(e =>
    e.cycle_id === currentCycleId && ['running', 'completed'].includes(e.status)
  ) ?? []

  const [sortKey, setSortKey] = useState<'cpa' | 'purchases' | 'ctr'>('cpa')

  if (cycleExperiments.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-8 py-16 text-center text-text-muted">
        <p className="text-lg font-medium mb-2">No running experiments</p>
        <p className="text-sm">Launch experiments on the Run tab first.</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-8 space-y-6">

      {/* Sort controls */}
      <div className="flex items-center gap-3">
        <p className="text-sm font-medium">Sort by:</p>
        {(['cpa', 'purchases', 'ctr'] as const).map(k => (
          <button key={k} onClick={() => setSortKey(k)}
            className={`text-sm px-3 py-1 rounded-lg ${sortKey === k ? 'bg-primary-light text-primary font-semibold' : 'text-text-muted hover:bg-bg'}`}>
            {k === 'cpa' ? 'Best CPA' : k === 'purchases' ? 'Most purchases' : 'Highest CTR'}
          </button>
        ))}
      </div>

      {/* Per-experiment results entry + decision */}
      {cycleExperiments.map(exp => (
        <ExperimentResultsRow
          key={exp.experiment_id}
          experiment={exp}
          showId={show_id}
          onUpdated={() => {
            qc.invalidateQueries({ queryKey: ['experiments', show_id] })
            qc.invalidateQueries({ queryKey: ['decisions', exp.experiment_id] })
          }}
        />
      ))}

    </div>
  )
}

interface ExperimentResultsRowProps {
  experiment: Experiment
  showId: string
  onUpdated: () => void
}

function ExperimentResultsRow({ experiment, showId, onUpdated }: ExperimentResultsRowProps) {
  const { data: metrics } = useExperimentMetrics(experiment.experiment_id)
  const { data: decisions } = useDecisions(experiment.experiment_id)
  const latestDecision = decisions?.[decisions.length - 1]

  const decisionMutation = useMutation({
    mutationFn: () => decisionsApi.evaluate(experiment.experiment_id),
    onSuccess: onUpdated,
  })

  const [showForm, setShowForm] = useState(false)

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      {/* Experiment header */}
      <div className="mb-4">
        <h4 className="font-semibold text-sm">{experiment.channel} experiment</h4>
        <p className="text-xs text-text-muted font-mono">{experiment.experiment_id.slice(0, 8)}</p>
      </div>

      {/* Metrics summary */}
      {metrics && (
        <div className="grid grid-cols-5 gap-4 mb-4">
          <MetricCell label="Spend" value={`$${(metrics.total_spend_cents / 100).toFixed(0)}`} />
          <MetricCell label="Clicks" value={metrics.total_clicks.toLocaleString()} />
          <MetricCell label="Purchases" value={metrics.total_purchases.toString()} />
          <MetricCell label="CPA" value={metrics.cpa_cents ? `$${(metrics.cpa_cents / 100).toFixed(2)}` : '—'} />
          <MetricCell label="ROAS" value={metrics.roas ? `${metrics.roas.toFixed(2)}x` : '—'} />
        </div>
      )}

      {/* Evidence warning */}
      {metrics && !metrics.evidence_sufficient && (
        <div className="text-xs text-warning bg-warning-light rounded px-2 py-1 mb-3 inline-block">
          ⚠ Low data — fewer than minimum clicks or observation windows
        </div>
      )}

      {/* Decision badge */}
      {latestDecision && (
        <div className="mb-3">
          <DecisionBadge decision={latestDecision} />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={() => setShowForm(v => !v)} className="btn-ghost text-sm">
          {showForm ? 'Hide form' : 'Enter Results'}
        </button>
        <button
          onClick={() => decisionMutation.mutate()}
          disabled={decisionMutation.isPending}
          className="btn-primary text-sm"
        >
          {decisionMutation.isPending ? 'Evaluating…' : 'Run Decision Engine'}
        </button>
      </div>

      {showForm && (
        <div className="mt-4">
          <ResultsEntryForm
            experimentId={experiment.experiment_id}
            onSaved={() => {
              setShowForm(false)
              onUpdated()
            }}
          />
        </div>
      )}
    </div>
  )
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="font-semibold text-text">{value}</p>
    </div>
  )
}
