const mockLaunchMutate = vi.fn()
const mockReapprovalMutate = vi.fn()

vi.mock('../queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../queries')>()
  return {
    ...actual,
    useLaunchRun: () => ({
      mutate: mockLaunchMutate,
      isPending: false,
      isError: false,
    }),
    useRequestRunReapproval: () => ({
      mutate: mockReapprovalMutate,
      isPending: false,
      isError: false,
    }),
  }
})

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RunActions } from './RunActions'
import type { RunResponse } from '../api'

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

describe('RunActions', () => {
  beforeEach(() => {
    mockLaunchMutate.mockReset()
    mockReapprovalMutate.mockReset()
  })

  it('shows Launch button for draft status', () => {
    render(<RunActions run={baseRun} />)
    expect(screen.getByRole('button', { name: /launch/i })).toBeInTheDocument()
  })

  it('shows Request Reapproval button for awaiting_approval status', () => {
    render(<RunActions run={{ ...baseRun, status: 'awaiting_approval' }} />)
    expect(screen.getByRole('button', { name: /request reapproval/i })).toBeInTheDocument()
  })

  it('renders nothing for active status', () => {
    const { container } = render(<RunActions run={{ ...baseRun, status: 'active' }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for decided status', () => {
    const { container } = render(<RunActions run={{ ...baseRun, status: 'decided' }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('opens confirmation dialog when Launch is clicked', () => {
    render(<RunActions run={baseRun} />)
    fireEvent.click(screen.getByRole('button', { name: /^launch$/i }))
    expect(screen.getByText('Launch this run?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm launch/i })).toBeInTheDocument()
  })

  it('calls useLaunchRun on confirm', () => {
    render(<RunActions run={baseRun} />)
    fireEvent.click(screen.getByRole('button', { name: /^launch$/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm launch/i }))
    expect(mockLaunchMutate).toHaveBeenCalledWith('run-1', expect.any(Object))
  })

  it('closes dialog on cancel without calling mutate', () => {
    render(<RunActions run={baseRun} />)
    fireEvent.click(screen.getByRole('button', { name: /^launch$/i }))
    expect(screen.getByText('Launch this run?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(mockLaunchMutate).not.toHaveBeenCalled()
  })

  it('calls useRequestRunReapproval when button clicked', () => {
    render(<RunActions run={{ ...baseRun, status: 'awaiting_approval' }} />)
    fireEvent.click(screen.getByRole('button', { name: /request reapproval/i }))
    expect(mockReapprovalMutate).toHaveBeenCalledWith('run-1')
  })
})
