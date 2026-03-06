'use client'

import { useObservations } from '@/features/observations/queries'
import { computeMetrics, computeAggregatedMetrics, getStatisticalFlags } from '@/features/observations/utils'

interface ResultsOverviewProps {
  runId: string
  onRunDecision: () => void
  isEvaluating: boolean
}

export function ResultsOverview({ runId, onRunDecision, isEvaluating }: ResultsOverviewProps) {
  const { data: observations, isLoading, error } = useObservations(runId)
  
  if (isLoading) {
    return <div className="animate-pulse h-32 bg-gray-200 rounded" />
  }
  
  if (error) {
    return <div className="text-red-500">Failed to load observations</div>
  }
  
  if (!observations || observations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No observations yet. Add observation data above.
      </div>
    )
  }
  
  const aggregated = computeAggregatedMetrics(observations)
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Spend" value={`$${(aggregated.totalSpend / 100).toFixed(2)}`} />
        <MetricCard label="Total Clicks" value={aggregated.totalClicks.toLocaleString()} />
        <MetricCard label="CTR" value={aggregated.ctr ? `${aggregated.ctr.toFixed(2)}%` : '—'} />
        <MetricCard label="CPA" value={aggregated.cpa ? `$${(aggregated.cpa / 100).toFixed(2)}` : '—'} />
        <MetricCard label="ROAS" value={aggregated.roas ? `${aggregated.roas.toFixed(2)}x` : '—'} />
        <MetricCard label="Purchases" value={aggregated.totalPurchases.toLocaleString()} />
        <MetricCard label="Revenue" value={`$${(aggregated.totalRevenue / 100).toFixed(2)}`} />
      </div>
      
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Observations</h3>
        {observations.map((obs) => {
          const metrics = computeMetrics(obs)
          const flags = getStatisticalFlags(obs)
          
          return (
            <div key={obs.observation_id} className="border rounded p-4">
              <div className="flex justify-between items-start">
                <div className="text-sm text-gray-500">
                  {new Date(obs.window_start).toLocaleDateString()} — {new Date(obs.window_end).toLocaleDateString()}
                </div>
                {flags.lowClicks && <span className="text-amber-600 text-xs">⚠️ Low clicks</span>}
                {flags.shortDuration && <span className="text-amber-600 text-xs">⚠️ Short duration</span>}
                {flags.lowSpend && <span className="text-amber-600 text-xs">⚠️ Low spend</span>}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-2">
                <div>
                  <div className="text-xs text-gray-500">Spend</div>
                  <div>${(obs.spend_cents / 100).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Impressions</div>
                  <div>{obs.impressions.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Clicks</div>
                  <div>{obs.clicks.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Purchases</div>
                  <div>{obs.purchases}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">CTR</div>
                  <div>{metrics.ctr ? `${metrics.ctr.toFixed(2)}%` : '—'}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      <div className="flex gap-4">
        <button
          onClick={onRunDecision}
          disabled={isEvaluating}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {isEvaluating ? 'Running Decision Engine...' : 'Run Decision Engine'}
        </button>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  )
}
