'use client'
import { useParams } from 'next/navigation'
import { useQueries } from '@tanstack/react-query'
import { useShow } from '@/lib/hooks/useShow'
import { useCycles } from '@/lib/hooks/useCycles'
import { useExperiments } from '@/lib/hooks/useExperiments'
import { useSegments } from '@/lib/hooks/useSegments'
import { useEvents } from '@/lib/hooks/useEvents'
import { experimentsApi } from '@/lib/api/experiments'
import { KPIStat } from '@/components/shared/KPIStat'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { NextActionPanel } from '@/components/overview/NextActionPanel'
import { ActivityFeed } from '@/components/overview/ActivityFeed'
import { PastDecisionsPanel } from '@/components/overview/PastDecisionsPanel'
import { ActiveExperimentsPanel } from '@/components/overview/ActiveExperimentsPanel'
import type { Show, Experiment, ExperimentMetrics } from '@/lib/types'

export default function OverviewPage() {
  const { show_id } = useParams<{ show_id: string }>()
  const { data: show } = useShow(show_id)
  const { data: cycles } = useCycles(show_id)
  const currentCycleId = cycles?.[0]?.cycle_id
  const { data: experiments } = useExperiments(show_id)
  const { data: segments } = useSegments(show_id, currentCycleId)
  const { data: events } = useEvents(show_id)

  const runningExperiments = experiments?.filter(e =>
    e.status === 'active' && e.cycle_id === currentCycleId
  ) ?? []

  if (!show) return <OverviewSkeleton />

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">

        {/* Next Action Panel */}
        <ErrorBoundary>
          <NextActionPanel
            show={show}
            segments={segments ?? []}
            experiments={experiments ?? []}
            showId={show_id}
            cycleId={currentCycleId ?? null}
          />
        </ErrorBoundary>

        {/* KPI Cards */}
        <ErrorBoundary>
          <KPISection showId={show_id} show={show} runningExperiments={runningExperiments} />
        </ErrorBoundary>

        {/* Two-column: Active experiments + Activity feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ErrorBoundary>
              <ActiveExperimentsPanel experiments={runningExperiments} showId={show_id} />
            </ErrorBoundary>
          </div>
          <div>
            <ErrorBoundary>
              <ActivityFeed events={events ?? []} />
            </ErrorBoundary>
          </div>
        </div>

        {/* Past cycle decisions */}
        <ErrorBoundary>
          <PastDecisionsPanel showId={show_id} experiments={experiments ?? []} />
        </ErrorBoundary>

      </div>
    </div>
  )
}

/* ---------- KPI Section ---------- */

function KPISection({
  showId,
  show,
  runningExperiments,
}: {
  showId: string
  show: Show
  runningExperiments: Experiment[]
}) {
  // Fetch metrics for each running experiment via useQueries
  const metricsQueries = useQueries({
    queries: runningExperiments.map(e => ({
      queryKey: ['experiments', e.experiment_id, 'metrics'],
      queryFn: () => experimentsApi.metrics(e.experiment_id),
      enabled: !!e.experiment_id,
    })),
  })

  const allMetrics: ExperimentMetrics[] = metricsQueries
    .map(q => q.data)
    .filter((d): d is ExperimentMetrics => !!d)

  const totals = allMetrics.reduce(
    (acc, m) => ({
      spend: acc.spend + m.total_spend_cents,
      purchases: acc.purchases + m.total_purchases,
      revenue: acc.revenue + m.total_revenue_cents,
    }),
    { spend: 0, purchases: 0, revenue: 0 }
  )

  const cpa = totals.purchases > 0 ? totals.spend / totals.purchases / 100 : null
  const roas = totals.spend > 0 ? totals.revenue / totals.spend : null
  const pct = show.tickets_total > 0
    ? Math.round((show.tickets_sold / show.tickets_total) * 100)
    : 0

  return (
    <section aria-labelledby="kpi-heading">
      <h3 id="kpi-heading" className="sr-only">Key Performance Indicators</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPIStat
          label="Tickets Sold"
          value={show.tickets_sold.toLocaleString()}
          subtext={`${(show.tickets_total - show.tickets_sold).toLocaleString()} remaining · ${pct}% sold`}
        />
        <KPIStat
          label="Cycle Spend"
          value={`$${(totals.spend / 100).toFixed(0)}`}
          subtext={`${runningExperiments.length} active experiments`}
        />
        <KPIStat
          label="Cost Per Ticket"
          value={cpa ? `$${cpa.toFixed(2)}` : '—'}
          subtext="Across running experiments"
          deltaDirection={cpa && cpa < 20 ? 'up' : cpa && cpa > 30 ? 'down' : 'neutral'}
        />
        <KPIStat
          label="ROAS"
          value={roas ? `${roas.toFixed(2)}x` : '—'}
          subtext={totals.revenue > 0 ? `Revenue: $${(totals.revenue / 100).toFixed(0)}` : undefined}
        />
      </div>
    </section>
  )
}

/* ---------- Skeleton ---------- */

function OverviewSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">
        {/* Next action skeleton */}
        <div className="bg-surface border border-border rounded-lg p-5 animate-pulse">
          <div className="h-5 bg-bg rounded w-1/3 mb-2" />
          <div className="h-4 bg-bg rounded w-1/4" />
        </div>

        {/* KPI cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-surface border border-border rounded-lg p-5 animate-pulse">
              <div className="h-4 bg-bg rounded w-1/2 mb-3" />
              <div className="h-8 bg-bg rounded w-2/3 mb-2" />
              <div className="h-3 bg-bg rounded w-3/4" />
            </div>
          ))}
        </div>

        {/* Two-column skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-surface border border-border rounded-lg p-5 animate-pulse">
              <div className="h-5 bg-bg rounded w-1/3 mb-4" />
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-bg rounded mb-3" />
              ))}
            </div>
          </div>
          <div>
            <div className="bg-surface border border-border rounded-lg p-5 animate-pulse">
              <div className="h-5 bg-bg rounded w-1/2 mb-4" />
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-10 bg-bg rounded mb-3" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
