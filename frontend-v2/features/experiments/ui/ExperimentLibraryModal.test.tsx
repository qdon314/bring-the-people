vi.mock('../queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../queries')>()
  return {
    ...actual,
    useExperiments: () => ({
      data: experiments,
      isLoading: false,
      error: null,
    }),
  }
})

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExperimentLibraryModal } from './ExperimentLibraryModal'
import type { ExperimentResponse } from '../api'

const experiments: ExperimentResponse[] = [
  {
    experiment_id: 'exp-1',
    show_id: 'show-1',
    origin_cycle_id: 'cycle-1',
    segment_id: 'seg-1',
    frame_id: 'frame-1',
    channel: 'email',
    objective: 'ticket_sales',
    budget_cap_cents: 50000,
    baseline_snapshot: {},
  },
  {
    experiment_id: 'exp-2',
    show_id: 'show-1',
    origin_cycle_id: 'cycle-1',
    segment_id: 'seg-2',
    frame_id: 'frame-2',
    channel: 'social',
    objective: 'awareness',
    budget_cap_cents: 30000,
    baseline_snapshot: {},
  },
]

describe('ExperimentLibraryModal', () => {
  it('renders experiment list when open', () => {
    render(
      <ExperimentLibraryModal
        open={true}
        onClose={vi.fn()}
        showId="show-1"
        onSelect={vi.fn()}
      />
    )
    expect(screen.getByText('email — ticket_sales')).toBeInTheDocument()
    expect(screen.getByText('social — awareness')).toBeInTheDocument()
  })

  it('does not render content when closed', () => {
    render(
      <ExperimentLibraryModal
        open={false}
        onClose={vi.fn()}
        showId="show-1"
        onSelect={vi.fn()}
      />
    )
    expect(screen.queryByText('email — ticket_sales')).not.toBeInTheDocument()
  })

  it('filters experiments by channel', () => {
    render(
      <ExperimentLibraryModal
        open={true}
        onClose={vi.fn()}
        showId="show-1"
        onSelect={vi.fn()}
      />
    )
    fireEvent.change(screen.getByRole('combobox', { name: /filter by channel/i }), {
      target: { value: 'email' },
    })
    expect(screen.getByText('email — ticket_sales')).toBeInTheDocument()
    expect(screen.queryByText('social — awareness')).not.toBeInTheDocument()
  })

  it('calls onSelect with the clicked experiment', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(
      <ExperimentLibraryModal
        open={true}
        onClose={onClose}
        showId="show-1"
        onSelect={onSelect}
      />
    )
    fireEvent.click(screen.getByText('email — ticket_sales'))
    expect(onSelect).toHaveBeenCalledWith(experiments[0])
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onSelect with social experiment when that row is clicked', () => {
    const onSelect = vi.fn()
    render(
      <ExperimentLibraryModal
        open={true}
        onClose={vi.fn()}
        showId="show-1"
        onSelect={onSelect}
      />
    )
    fireEvent.click(screen.getByText('social — awareness'))
    expect(onSelect).toHaveBeenCalledWith(experiments[1])
  })
})
