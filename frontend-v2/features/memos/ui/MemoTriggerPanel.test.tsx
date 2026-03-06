// Mock modules before importing the component
const mockMutateAsync = vi.fn()
const mockInvalidateQueries = vi.fn()
let mockIsPending = false
let mockIsError = false
let mockError: Error | null = null

vi.mock('../mutations', () => ({
  useRunMemo: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
    isError: mockIsError,
    error: mockError,
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
import { MemoTriggerPanel } from './MemoTriggerPanel'

const SHOW_ID = 'show-1'
const CYCLE_START = '2026-01-01T00:00:00Z'
const CYCLE_END = '2026-02-01T00:00:00Z'

describe('MemoTriggerPanel', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset()
    mockInvalidateQueries.mockReset()
    mockIsPending = false
    mockIsError = false
    mockError = null
  })

  it('shows Generate Memo button', () => {
    render(<MemoTriggerPanel showId={SHOW_ID} cycleStart={CYCLE_START} cycleEnd={CYCLE_END} />)
    expect(screen.getByRole('button', { name: /generate memo/i })).toBeInTheDocument()
  })

  it('displays title and description', () => {
    render(<MemoTriggerPanel showId={SHOW_ID} cycleStart={CYCLE_START} cycleEnd={CYCLE_END} />)
    expect(screen.getByRole('heading', { name: /generate memo/i })).toBeInTheDocument()
    expect(screen.getByText(/generate a cycle summary memo/i)).toBeInTheDocument()
  })

  it('button is enabled when idle', () => {
    render(<MemoTriggerPanel showId={SHOW_ID} cycleStart={CYCLE_START} cycleEnd={CYCLE_END} />)
    expect(screen.getByRole('button', { name: /generate memo/i })).not.toBeDisabled()
  })

  it('calls mutateAsync with cycle dates when clicked', () => {
    mockMutateAsync.mockResolvedValue({ job_id: 'job-1' })
    render(<MemoTriggerPanel showId={SHOW_ID} cycleStart={CYCLE_START} cycleEnd={CYCLE_END} />)
    fireEvent.click(screen.getByRole('button', { name: /generate memo/i }))
    expect(mockMutateAsync).toHaveBeenCalledWith({
      cycleStart: CYCLE_START,
      cycleEnd: CYCLE_END,
    })
  })

  it('disables button and shows spinner while mutation is pending', () => {
    mockIsPending = true
    render(<MemoTriggerPanel showId={SHOW_ID} cycleStart={CYCLE_START} cycleEnd={CYCLE_END} />)
    const btn = screen.getByRole('button', { name: /generating/i })
    expect(btn).toBeDisabled()
    expect(screen.getByText(/generating/i)).toBeInTheDocument()
  })

  it('shows error banner on mutation failure', () => {
    mockIsError = true
    mockError = new Error('Network error')
    render(<MemoTriggerPanel showId={SHOW_ID} cycleStart={CYCLE_START} cycleEnd={CYCLE_END} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/failed to start memo generation/i)).toBeInTheDocument()
  })
})
