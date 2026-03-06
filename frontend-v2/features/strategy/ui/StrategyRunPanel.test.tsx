// Mock modules before importing the component
const mockMutateAsync = vi.fn()
const mockInvalidateQueries = vi.fn()
let mockIsPending = false

vi.mock('../mutations', () => ({
  useRunStrategy: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
    isError: false,
    error: null,
  }),
}))

vi.mock('@/features/jobs/useJobPolling', () => ({
  useJobPolling: () => ({
    isPolling: false,
    isCompleted: false,
    isFailed: false,
    error: null,
  }),
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  }
})

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StrategyRunPanel } from './StrategyRunPanel'

const SHOW_ID = 'show-1'
const CYCLE_ID = 'cycle-1'

describe('StrategyRunPanel', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset()
    mockInvalidateQueries.mockReset()
    mockIsPending = false
  })

  it('shows Run Strategy button', () => {
    render(<StrategyRunPanel showId={SHOW_ID} cycleId={CYCLE_ID} />)
    expect(screen.getByRole('button', { name: /run strategy/i })).toBeInTheDocument()
  })

  it('displays correct title and description', () => {
    render(<StrategyRunPanel showId={SHOW_ID} cycleId={CYCLE_ID} />)
    expect(screen.getByRole('heading', { name: /run strategy/i })).toBeInTheDocument()
    expect(screen.getByText(/generate segment suggestions/i)).toBeInTheDocument()
  })

  it('button is enabled when idle', () => {
    render(<StrategyRunPanel showId={SHOW_ID} cycleId={CYCLE_ID} />)
    expect(screen.getByRole('button', { name: /run strategy/i })).not.toBeDisabled()
  })

  it('calls mutateAsync when button is clicked', () => {
    mockMutateAsync.mockResolvedValue({ job_id: 'job-1' })
    render(<StrategyRunPanel showId={SHOW_ID} cycleId={CYCLE_ID} />)
    fireEvent.click(screen.getByRole('button', { name: /run strategy/i }))
    expect(mockMutateAsync).toHaveBeenCalledOnce()
  })

  it('disables button and shows spinner while mutation is pending', () => {
    mockIsPending = true
    render(<StrategyRunPanel showId={SHOW_ID} cycleId={CYCLE_ID} />)
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByText(/running/i)).toBeInTheDocument()
  })
})

