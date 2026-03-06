import type { ObservationResponse } from './api'

export interface ComputedMetrics {
  ctr: number | null
  cpc: number | null
  cpa: number | null
  roas: number | null
}

export function computeMetrics(observation: ObservationResponse): ComputedMetrics {
  const { impressions, clicks, spend_cents, purchases, revenue_cents } = observation
  
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : null
  const cpc = clicks > 0 ? spend_cents / clicks : null
  const cpa = purchases > 0 ? spend_cents / purchases : null
  const roas = spend_cents > 0 ? revenue_cents / spend_cents : null
  
  return { ctr, cpc, cpa, roas }
}

export function computeAggregatedMetrics(observations: ObservationResponse[]): ComputedMetrics & { totalSpend: number; totalImpressions: number; totalClicks: number; totalPurchases: number; totalRevenue: number } {
  const totals = observations.reduce(
    (acc, obs) => ({
      spend: acc.spend + obs.spend_cents,
      impressions: acc.impressions + obs.impressions,
      clicks: acc.clicks + obs.clicks,
      purchases: acc.purchases + obs.purchases,
      revenue: acc.revenue + obs.revenue_cents,
    }),
    { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 }
  )
  
  const { spend, impressions, clicks, purchases, revenue } = totals
  
  return {
    totalSpend: spend,
    totalImpressions: impressions,
    totalClicks: clicks,
    totalPurchases: purchases,
    totalRevenue: revenue,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    cpc: clicks > 0 ? spend / clicks : null,
    cpa: purchases > 0 ? spend / purchases : null,
    roas: spend > 0 ? revenue / spend : null,
  }
}

export interface StatisticalFlags {
  lowClicks: boolean
  shortDuration: boolean
  lowSpend: boolean
}

export function getStatisticalFlags(observation: ObservationResponse): StatisticalFlags {
  const MIN_CLICKS = 50
  const MIN_DURATION_DAYS = 3
  const MIN_SPEND_DOLLARS = 50
  
  const durationMs = new Date(observation.window_end).getTime() - new Date(observation.window_start).getTime()
  const durationDays = durationMs / (1000 * 60 * 60 * 24)
  const spendDollars = observation.spend_cents / 100
  
  return {
    lowClicks: observation.clicks < MIN_CLICKS,
    shortDuration: durationDays < MIN_DURATION_DAYS,
    lowSpend: spendDollars < MIN_SPEND_DOLLARS,
  }
}
