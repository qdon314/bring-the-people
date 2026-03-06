import { describe, it, expect } from 'vitest'
import { computeMetrics, computeAggregatedMetrics, getStatisticalFlags } from './utils'
import type { ObservationResponse } from './api'

const mockObservation = (
  overrides: Partial<ObservationResponse> = {}
): ObservationResponse => ({
  observation_id: 'test-id',
  run_id: 'run-id',
  window_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  window_end: new Date().toISOString(),
  spend_cents: 10000,
  impressions: 10000,
  clicks: 500,
  sessions: 0,
  checkouts: 0,
  purchases: 50,
  revenue_cents: 25000,
  refunds: 0,
  refund_cents: 0,
  complaints: 0,
  attribution_model: 'last_click_utm',
  created_at: new Date().toISOString(),
  ...overrides,
})

describe('computeMetrics', () => {
  it('calculates CTR correctly', () => {
    const obs = mockObservation({ impressions: 1000, clicks: 50 })
    const metrics = computeMetrics(obs)
    expect(metrics.ctr).toBe(5)
  })

  it('calculates CPC correctly', () => {
    const obs = mockObservation({ spend_cents: 1000, clicks: 100 })
    const metrics = computeMetrics(obs)
    expect(metrics.cpc).toBe(10)
  })

  it('calculates CPA correctly', () => {
    const obs = mockObservation({ spend_cents: 5000, purchases: 50 })
    const metrics = computeMetrics(obs)
    expect(metrics.cpa).toBe(100)
  })

  it('calculates ROAS correctly', () => {
    const obs = mockObservation({ spend_cents: 10000, revenue_cents: 25000 })
    const metrics = computeMetrics(obs)
    expect(metrics.roas).toBe(2.5)
  })

  it('returns null for CTR when impressions is 0', () => {
    const obs = mockObservation({ impressions: 0, clicks: 0 })
    const metrics = computeMetrics(obs)
    expect(metrics.ctr).toBeNull()
  })

  it('returns null for CPC when clicks is 0', () => {
    const obs = mockObservation({ spend_cents: 1000, clicks: 0 })
    const metrics = computeMetrics(obs)
    expect(metrics.cpc).toBeNull()
  })

  it('returns null for CPA when purchases is 0', () => {
    const obs = mockObservation({ spend_cents: 1000, purchases: 0 })
    const metrics = computeMetrics(obs)
    expect(metrics.cpa).toBeNull()
  })

  it('returns null for ROAS when spend is 0', () => {
    const obs = mockObservation({ spend_cents: 0, revenue_cents: 1000 })
    const metrics = computeMetrics(obs)
    expect(metrics.roas).toBeNull()
  })
})

describe('computeAggregatedMetrics', () => {
  it('aggregates totals correctly', () => {
    const observations = [
      mockObservation({ spend_cents: 1000, impressions: 100, clicks: 10, purchases: 1, revenue_cents: 500 }),
      mockObservation({ spend_cents: 2000, impressions: 200, clicks: 20, purchases: 2, revenue_cents: 1000 }),
    ]
    const result = computeAggregatedMetrics(observations)
    
    expect(result.totalSpend).toBe(3000)
    expect(result.totalImpressions).toBe(300)
    expect(result.totalClicks).toBe(30)
    expect(result.totalPurchases).toBe(3)
    expect(result.totalRevenue).toBe(1500)
  })

  it('calculates aggregated metrics correctly', () => {
    const observations = [
      mockObservation({ spend_cents: 1000, impressions: 100, clicks: 10, purchases: 1, revenue_cents: 500 }),
      mockObservation({ spend_cents: 2000, impressions: 200, clicks: 20, purchases: 2, revenue_cents: 1000 }),
    ]
    const result = computeAggregatedMetrics(observations)
    
    expect(result.ctr).toBe(10)
    expect(result.cpc).toBe(100)
    expect(result.cpa).toBe(1000)
    expect(result.roas).toBe(0.5)
  })

  it('handles empty array', () => {
    const result = computeAggregatedMetrics([])
    
    expect(result.totalSpend).toBe(0)
    expect(result.totalImpressions).toBe(0)
    expect(result.totalClicks).toBe(0)
    expect(result.totalPurchases).toBe(0)
    expect(result.totalRevenue).toBe(0)
    expect(result.ctr).toBeNull()
    expect(result.cpc).toBeNull()
    expect(result.cpa).toBeNull()
    expect(result.roas).toBeNull()
  })
})

describe('getStatisticalFlags', () => {
  it('flags low clicks when under 50', () => {
    const obs = mockObservation({ clicks: 30 })
    const flags = getStatisticalFlags(obs)
    expect(flags.lowClicks).toBe(true)
  })

  it('does not flag low clicks when over 50', () => {
    const obs = mockObservation({ clicks: 100 })
    const flags = getStatisticalFlags(obs)
    expect(flags.lowClicks).toBe(false)
  })

  it('flags short duration when under 3 days', () => {
    const obs = mockObservation({
      window_start: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      window_end: new Date().toISOString(),
    })
    const flags = getStatisticalFlags(obs)
    expect(flags.shortDuration).toBe(true)
  })

  it('does not flag short duration when over 3 days', () => {
    const obs = mockObservation({
      window_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      window_end: new Date().toISOString(),
    })
    const flags = getStatisticalFlags(obs)
    expect(flags.shortDuration).toBe(false)
  })

  it('flags low spend when under $50', () => {
    const obs = mockObservation({ spend_cents: 3000 })
    const flags = getStatisticalFlags(obs)
    expect(flags.lowSpend).toBe(true)
  })

  it('does not flag low spend when over $50', () => {
    const obs = mockObservation({ spend_cents: 10000 })
    const flags = getStatisticalFlags(obs)
    expect(flags.lowSpend).toBe(false)
  })
})
