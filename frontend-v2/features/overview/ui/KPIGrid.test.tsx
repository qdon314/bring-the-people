import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KPIGrid, KPIGridSkeleton } from './KPIGrid'
import type { components } from '@/shared/api/generated/schema'

type ShowResponse = components['schemas']['ShowResponse']
type ObservationResponse = components['schemas']['ObservationResponse']

const baseShow: ShowResponse = {
  show_id: 'show-1',
  artist_name: 'Test Artist',
  city: 'NYC',
  venue: 'Madison Square Garden',
  show_time: '2026-06-01T20:00:00Z',
  timezone: 'America/New_York',
  capacity: 1000,
  tickets_total: 1000,
  tickets_sold: 250,
  currency: 'USD',
}

function makeObservation(overrides: Partial<ObservationResponse> = {}): ObservationResponse {
  return {
    observation_id: 'obs-1',
    run_id: 'run-1',
    window_start: '2026-01-01T00:00:00Z',
    window_end: '2026-01-07T00:00:00Z',
    spend_cents: 0,
    impressions: 0,
    clicks: 0,
    sessions: 0,
    checkouts: 0,
    purchases: 0,
    revenue_cents: 0,
    refunds: 0,
    refund_cents: 0,
    complaints: 0,
    negative_comment_rate: null,
    attribution_model: 'last_click_utm',
    ...overrides,
  }
}

describe('KPIGrid', () => {
  it('shows tickets sold and capacity', () => {
    render(<KPIGrid show={baseShow} observations={[]} />)
    expect(screen.getByText('250')).toBeInTheDocument()
    expect(screen.getByText(/of 1,000 capacity/i)).toBeInTheDocument()
  })

  it('shows — for spend and purchases when no observations', () => {
    render(<KPIGrid show={baseShow} observations={[]} />)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })

  it('shows — for CPA when purchases is zero', () => {
    const obs = makeObservation({ spend_cents: 10000, purchases: 0 })
    render(<KPIGrid show={baseShow} observations={[obs]} />)
    // Both purchases and CPA show — when purchases = 0
    const dashes = screen.getAllByText('—', { selector: 'dd' })
    expect(dashes.length).toBeGreaterThanOrEqual(2)
    // CPA label is present
    expect(screen.getByText('CPA')).toBeInTheDocument()
  })

  it('computes and displays CPA when purchases > 0', () => {
    const obs = makeObservation({ spend_cents: 5000, purchases: 2 })
    render(<KPIGrid show={baseShow} observations={[obs]} />)
    // CPA = $50 / 2 = $25
    expect(screen.getByText('$25')).toBeInTheDocument()
  })

  it('aggregates spend across multiple observations', () => {
    const obs1 = makeObservation({ spend_cents: 5000, purchases: 1 })
    const obs2 = makeObservation({ observation_id: 'obs-2', spend_cents: 5000, purchases: 1 })
    render(<KPIGrid show={baseShow} observations={[obs1, obs2]} />)
    expect(screen.getByText('$100')).toBeInTheDocument()
  })
})

describe('KPIGridSkeleton', () => {
  it('renders and is aria-hidden', () => {
    const { container } = render(<KPIGridSkeleton />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders 4 skeleton cells', () => {
    const { container } = render(<KPIGridSkeleton />)
    const cells = container.querySelectorAll('.animate-pulse')
    expect(cells).toHaveLength(4)
  })
})
