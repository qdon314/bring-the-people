import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RunCard } from './RunCard'
import type { RunResponse } from '../api'
import type { ExperimentResponse } from '@/features/experiments/api'

const baseRun: RunResponse = {
  run_id: 'run-1',
  experiment_id: 'exp-1',
  cycle_id: 'cycle-1',
  status: 'draft',
  start_time: null,
  end_time: null,
  budget_cap_cents_override: null,
  channel_config: {},
  variant_snapshot: {},
}

const experiment: ExperimentResponse = {
  experiment_id: 'exp-1',
  show_id: 'show-1',
  origin_cycle_id: 'cycle-1',
  segment_id: 'seg-1',
  frame_id: 'frame-1',
  channel: 'email',
  objective: 'ticket_sales',
  budget_cap_cents: 50000,
  baseline_snapshot: {},
}

describe('RunCard', () => {
  it('renders experiment label from channel and objective', () => {
    render(<RunCard run={baseRun} experiment={experiment} />)
    expect(screen.getByText('email — ticket_sales')).toBeInTheDocument()
  })

  it('shows "Unknown experiment" when experiment is undefined', () => {
    render(<RunCard run={baseRun} experiment={undefined} />)
    expect(screen.getByText('Unknown experiment')).toBeInTheDocument()
  })

  it('renders status badge', () => {
    render(<RunCard run={baseRun} experiment={experiment} />)
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('renders active status badge correctly', () => {
    render(<RunCard run={{ ...baseRun, status: 'active' }} experiment={experiment} />)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('shows em-dash for null dates', () => {
    render(<RunCard run={baseRun} experiment={experiment} />)
    expect(screen.getByText('Start: —')).toBeInTheDocument()
    expect(screen.getByText('End: —')).toBeInTheDocument()
  })

  it('shows formatted dates when present', () => {
    render(
      <RunCard
        run={{ ...baseRun, start_time: '2026-03-01T00:00:00Z', end_time: '2026-03-15T00:00:00Z' }}
        experiment={experiment}
      />
    )
    expect(screen.getByText(/Start:/)).toBeInTheDocument()
    expect(screen.getByText(/End:/)).toBeInTheDocument()
  })

  it('shows budget override when set', () => {
    render(
      <RunCard run={{ ...baseRun, budget_cap_cents_override: 25000 }} experiment={experiment} />
    )
    expect(screen.getByText(/250.*override/i)).toBeInTheDocument()
  })

  it('does not show budget override when null', () => {
    render(<RunCard run={baseRun} experiment={experiment} />)
    expect(screen.queryByText(/override/i)).not.toBeInTheDocument()
  })
})
