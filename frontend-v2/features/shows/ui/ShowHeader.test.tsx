import React from 'react'
import { render, screen } from '@testing-library/react'
import { ShowHeader, ShowHeaderSkeleton } from './ShowHeader'
import type { components } from '@/shared/api/generated/schema'

type ShowResponse = components['schemas']['ShowResponse']
type CycleResponse = components['schemas']['CycleResponse']

function makeShow(overrides: Partial<ShowResponse> = {}): ShowResponse {
  return {
    show_id: 'show-1',
    artist_name: 'The Midnight',
    city: 'Los Angeles',
    venue: 'The Wiltern',
    show_time: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days out
    timezone: 'America/Los_Angeles',
    capacity: 2000,
    tickets_total: 2000,
    tickets_sold: 800,
    currency: 'USD',
    ...overrides,
  }
}

function makeCycle(overrides: Partial<CycleResponse> = {}): CycleResponse {
  return {
    cycle_id: 'cycle-1',
    show_id: 'show-1',
    started_at: '2026-03-01T00:00:00Z',
    label: 'Cycle 1',
    ...overrides,
  }
}

describe('ShowHeader', () => {
  it('renders artist name', () => {
    render(<ShowHeader show={makeShow()} />)
    expect(screen.getByRole('heading', { name: 'The Midnight' })).toBeInTheDocument()
  })

  it('renders city and venue', () => {
    render(<ShowHeader show={makeShow()} />)
    expect(screen.getByText(/Los Angeles/)).toBeInTheDocument()
    expect(screen.getByText(/The Wiltern/)).toBeInTheDocument()
  })

  it('renders formatted show date', () => {
    const showTime = new Date('2026-08-15T20:00:00Z').toISOString()
    render(<ShowHeader show={makeShow({ show_time: showTime, timezone: 'America/Los_Angeles' })} />)
    // Should render a date string containing August
    expect(screen.getByText(/Aug/)).toBeInTheDocument()
  })

  it('shows Early phase badge when >60 days away', () => {
    const show = makeShow({
      show_time: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    })
    render(<ShowHeader show={show} />)
    expect(screen.getByText('Early')).toBeInTheDocument()
  })

  it('shows Mid phase badge when 8–60 days away', () => {
    const show = makeShow({
      show_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    render(<ShowHeader show={show} />)
    expect(screen.getByText('Mid')).toBeInTheDocument()
  })

  it('shows Late phase badge when ≤8 days away', () => {
    const show = makeShow({
      show_time: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    })
    render(<ShowHeader show={show} />)
    expect(screen.getByText('Late')).toBeInTheDocument()
  })

  it('shows Late phase and "Show day" when show has passed', () => {
    const show = makeShow({
      show_time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    })
    render(<ShowHeader show={show} />)
    expect(screen.getByText('Late')).toBeInTheDocument()
    expect(screen.getByText('Show day')).toBeInTheDocument()
  })

  it('renders days away count when show is upcoming', () => {
    const show = makeShow({
      show_time: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    })
    render(<ShowHeader show={show} />)
    expect(screen.getByText(/days away/)).toBeInTheDocument()
  })

  it('renders cycle label when cycle with label is provided', () => {
    render(<ShowHeader show={makeShow()} cycle={makeCycle({ label: 'Cycle 1' })} />)
    expect(screen.getByText('Cycle 1')).toBeInTheDocument()
  })

  it('renders fallback cycle date when cycle label is null', () => {
    render(<ShowHeader show={makeShow()} cycle={makeCycle({ label: null })} />)
    expect(screen.getByText(/Cycle started/)).toBeInTheDocument()
  })

  it('does not render cycle info when no cycle provided', () => {
    render(<ShowHeader show={makeShow()} />)
    expect(screen.queryByText(/Cycle/)).not.toBeInTheDocument()
  })
})

describe('ShowHeaderSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<ShowHeaderSkeleton />)
    expect(container.firstChild).not.toBeNull()
  })

  it('renders animate-pulse elements', () => {
    const { container } = render(<ShowHeaderSkeleton />)
    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })
})
