import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { daysUntilShow, getShowPhaseLabel } from '@/lib/utils/dates'
import type { Show, Segment, Experiment } from '@/lib/types'

type NextAction =
  | { type: 'run_strategy'; label: string; href: string }
  | { type: 'generate_creative'; label: string; href: string }
  | { type: 'build_experiments'; label: string; href: string }
  | { type: 'enter_results'; label: string; href: string }
  | { type: 'run_decisions'; label: string; href: string }
  | { type: 'generate_memo'; label: string; href: string }
  | { type: 'all_done'; label: string; href: string }

function getNextAction(params: {
  showId: string
  segments: Segment[]
  experiments: Experiment[]
  cycleId: string | null
}): NextAction {
  const { showId, segments, experiments, cycleId } = params
  const base = `/shows/${showId}`

  // No segments for current cycle → run strategy
  if (!segments.length) {
    return { type: 'run_strategy', label: 'Run Strategy Agent', href: `${base}/plan` }
  }

  // Segments but no approved ones
  const approvedSegments = segments.filter(s => s.review_status === 'approved')
  if (!approvedSegments.length) {
    return { type: 'run_strategy', label: 'Review and approve segments', href: `${base}/plan` }
  }

  // No experiments in this cycle
  const cycleExperiments = experiments.filter(e => e.cycle_id === cycleId)
  if (!cycleExperiments.length) {
    return { type: 'build_experiments', label: 'Build experiments from approved creative', href: `${base}/run` }
  }

  // Experiments exist but none are running
  const running = cycleExperiments.filter(e => e.status === 'running')
  if (!running.length) {
    return { type: 'enter_results', label: 'Launch experiments and enter results', href: `${base}/run` }
  }

  // Running experiments → enter results
  return { type: 'enter_results', label: 'Enter results for running experiments', href: `${base}/results` }
}

interface Props {
  show: Show
  segments: Segment[]
  experiments: Experiment[]
  showId: string
  cycleId: string | null
}

export function NextActionPanel({ show, segments, experiments, showId, cycleId }: Props) {
  const action = getNextAction({ showId, segments, experiments, cycleId })
  const days = daysUntilShow(show.show_time)

  return (
    <section aria-labelledby="next-action-heading">
      <div className="bg-primary-light border border-primary/20 rounded-lg p-5 flex items-center justify-between">
        <div>
          <h3 id="next-action-heading" className="font-semibold text-text mb-1">
            Next: {action.label}
          </h3>
          <p className="text-sm text-text-muted">
            {days > 0
              ? `${days} days until show · ${getShowPhaseLabel(days)} phase`
              : 'Show date passed'}
          </p>
        </div>
        <Link
          href={action.href}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg transition-colors"
        >
          {action.label}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  )
}
