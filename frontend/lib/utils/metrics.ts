import type { Observation } from '../types'

export interface ComputedMetrics {
  total_spend_usd: number
  total_revenue_usd: number
  total_clicks: number
  total_impressions: number
  total_purchases: number
  ctr: number | null
  cpc_usd: number | null
  cpa_usd: number | null
  roas: number | null
  conversion_rate: number | null
}

export function computeMetrics(observations: Observation[]): ComputedMetrics {
  const totals = observations.reduce(
    (acc, obs) => ({
      spend: acc.spend + obs.spend_cents,
      revenue: acc.revenue + obs.revenue_cents,
      clicks: acc.clicks + obs.clicks,
      impressions: acc.impressions + obs.impressions,
      purchases: acc.purchases + obs.purchases,
    }),
    { spend: 0, revenue: 0, clicks: 0, impressions: 0, purchases: 0 }
  )

  return {
    total_spend_usd: totals.spend / 100,
    total_revenue_usd: totals.revenue / 100,
    total_clicks: totals.clicks,
    total_impressions: totals.impressions,
    total_purchases: totals.purchases,
    ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : null,
    cpc_usd: totals.clicks > 0 ? (totals.spend / 100) / totals.clicks : null,
    cpa_usd: totals.purchases > 0 ? (totals.spend / 100) / totals.purchases : null,
    roas: totals.spend > 0 ? totals.revenue / totals.spend : null,
    conversion_rate: totals.clicks > 0 ? totals.purchases / totals.clicks : null,
  }
}

// For preview while user is typing (partial form data)
export function computePreviewMetrics(input: {
  spend_usd: number
  impressions: number
  clicks: number
  purchases: number
  revenue_usd: number
}): ComputedMetrics {
  return computeMetrics([{
    observation_id: '',
    experiment_id: '',
    window_start: '',
    window_end: '',
    spend_cents: Math.round(input.spend_usd * 100),
    revenue_cents: Math.round(input.revenue_usd * 100),
    clicks: input.clicks,
    impressions: input.impressions,
    purchases: input.purchases,
    sessions: 0,
    checkouts: 0,
    refunds: 0,
    refund_cents: 0,
    complaints: 0,
    negative_comment_rate: null,
    attribution_model: 'last_click_utm',
  }])
}
