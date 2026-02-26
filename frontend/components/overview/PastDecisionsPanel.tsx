import { useDecisions } from '@/lib/hooks/useDecisions'
import type { Experiment } from '@/lib/types'

export function PastDecisionsPanel({ showId, experiments }: { showId: string; experiments: Experiment[] }) {
  // Past cycle = experiments not in current cycle with decisions
  const completedExperiments = experiments.filter(e =>
    ['completed', 'stopped'].includes(e.status)
  )

  if (!completedExperiments.length) return null

  return (
    <section aria-labelledby="decisions-heading">
      <div className="bg-surface border border-border rounded-lg">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 id="decisions-heading" className="font-semibold">Past Cycle Decisions</h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {completedExperiments.slice(0, 6).map(exp => (
              <ExperimentDecisionCard key={exp.experiment_id} experimentId={exp.experiment_id} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function ExperimentDecisionCard({ experimentId }: { experimentId: string }) {
  const { data: decisions } = useDecisions(experimentId)
  const latest = decisions?.[decisions.length - 1]
  if (!latest) return null

  const styleMap: Record<string, { bg: string; text: string; dot: string }> = {
    scale: { bg: 'bg-success-light', text: 'text-success', dot: 'bg-success' },
    hold: { bg: 'bg-warning-light', text: 'text-warning', dot: 'bg-warning' },
    kill: { bg: 'bg-danger-light', text: 'text-danger', dot: 'bg-danger' },
  }

  const styles = styleMap[latest.action] ?? styleMap.hold

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${styles.bg}`}>
      <span className={`flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold ${styles.dot}`}>
        {latest.action[0].toUpperCase()}
      </span>
      <div>
        <p className={`text-sm font-semibold ${styles.text}`}>
          {latest.action.charAt(0).toUpperCase() + latest.action.slice(1)}
        </p>
        <p className="text-xs text-text-muted">
          {latest.metrics_snapshot.cac_cents
            ? `CPA $${(Number(latest.metrics_snapshot.cac_cents) / 100).toFixed(2)}`
            : latest.rationale.slice(0, 40)
          }
        </p>
      </div>
    </div>
  )
}
