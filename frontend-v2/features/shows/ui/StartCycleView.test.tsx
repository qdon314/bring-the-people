import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StartCycleView } from './StartCycleView'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/features/cycles/queries', () => ({
  useCreateCycle: vi.fn(),
}))

import { useCreateCycle } from '@/features/cycles/queries'

const mockUseCreateCycle = vi.mocked(useCreateCycle)

function makeMutation(overrides = {}) {
  return {
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    ...overrides,
  }
}

describe('StartCycleView', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockUseCreateCycle.mockReturnValue(makeMutation() as ReturnType<typeof useCreateCycle>)
  })

  it('renders heading and Start Cycle button', () => {
    render(<StartCycleView showId="show-1" />)
    expect(screen.getByRole('heading', { name: /no cycles yet/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start cycle/i })).toBeInTheDocument()
  })

  it('disables button and shows loading text while pending', () => {
    mockUseCreateCycle.mockReturnValue(
      makeMutation({ isPending: true }) as ReturnType<typeof useCreateCycle>,
    )
    render(<StartCycleView showId="show-1" />)
    const button = screen.getByRole('button', { name: /starting/i })
    expect(button).toBeDisabled()
  })

  it('shows error alert on failure', () => {
    mockUseCreateCycle.mockReturnValue(
      makeMutation({ error: new Error('Server error') }) as ReturnType<typeof useCreateCycle>,
    )
    render(<StartCycleView showId="show-1" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/failed to create cycle/i)
  })

  it('redirects to new cycle overview on success', async () => {
    const newCycle = {
      cycle_id: 'cycle-new',
      show_id: 'show-1',
      started_at: '2026-03-05T00:00:00Z',
      label: null,
    }
    const mutateAsync = vi.fn().mockResolvedValue(newCycle)
    mockUseCreateCycle.mockReturnValue(
      makeMutation({ mutateAsync }) as ReturnType<typeof useCreateCycle>,
    )

    render(<StartCycleView showId="show-1" />)
    fireEvent.click(screen.getByRole('button', { name: /start cycle/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/shows/show-1/cycles/cycle-new/overview')
    })
  })
})
