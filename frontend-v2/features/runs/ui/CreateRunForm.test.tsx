const mockCreateRunMutate = vi.fn()

vi.mock('../queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../queries')>()
  return {
    ...actual,
    useCreateRun: () => ({
      mutate: mockCreateRunMutate,
      isPending: false,
      isError: false,
    }),
  }
})

// Mock ExperimentLibraryModal to control experiment selection in tests
vi.mock('@/features/experiments/ui/ExperimentLibraryModal', () => ({
  ExperimentLibraryModal: ({
    open,
    onSelect,
    onClose,
  }: {
    open: boolean
    onSelect: (exp: unknown) => void
    onClose: () => void
    showId: string
  }) => {
    if (!open) return null
    return (
      <div data-testid="library-modal">
        <button
          onClick={() => {
            onSelect({
              experiment_id: 'exp-1',
              show_id: 'show-1',
              origin_cycle_id: 'cycle-1',
              segment_id: 'seg-1',
              frame_id: 'frame-1',
              channel: 'email',
              objective: 'ticket_sales',
              budget_cap_cents: 50000,
              baseline_snapshot: {},
            })
            onClose()
          }}
        >
          Select email experiment
        </button>
      </div>
    )
  },
}))

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateRunForm } from './CreateRunForm'

const SHOW_ID = 'show-1'
const CYCLE_ID = 'cycle-1'

describe('CreateRunForm', () => {
  beforeEach(() => {
    mockCreateRunMutate.mockReset()
  })

  it('renders with submit button disabled when no experiment selected', () => {
    render(<CreateRunForm showId={SHOW_ID} cycleId={CYCLE_ID} />)
    expect(screen.getByRole('button', { name: /create run/i })).toBeDisabled()
  })

  it('opens experiment library modal on button click', () => {
    render(<CreateRunForm showId={SHOW_ID} cycleId={CYCLE_ID} />)
    fireEvent.click(screen.getByRole('button', { name: /pick experiment/i }))
    expect(screen.getByTestId('library-modal')).toBeInTheDocument()
  })

  it('displays selected experiment after picking from library', () => {
    render(<CreateRunForm showId={SHOW_ID} cycleId={CYCLE_ID} />)
    fireEvent.click(screen.getByRole('button', { name: /pick experiment/i }))
    fireEvent.click(screen.getByRole('button', { name: /select email experiment/i }))
    expect(screen.getByText('email — ticket_sales')).toBeInTheDocument()
  })

  it('enables submit after experiment is selected', async () => {
    render(<CreateRunForm showId={SHOW_ID} cycleId={CYCLE_ID} />)
    fireEvent.click(screen.getByRole('button', { name: /pick experiment/i }))
    fireEvent.click(screen.getByRole('button', { name: /select email experiment/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create run/i })).not.toBeDisabled()
    })
  })

  it('submits with correct experiment_id and cycle_id', async () => {
    render(<CreateRunForm showId={SHOW_ID} cycleId={CYCLE_ID} />)
    fireEvent.click(screen.getByRole('button', { name: /pick experiment/i }))
    fireEvent.click(screen.getByRole('button', { name: /select email experiment/i }))

    fireEvent.click(screen.getByRole('button', { name: /create run/i }))

    await waitFor(() => expect(mockCreateRunMutate).toHaveBeenCalledOnce())
    expect(mockCreateRunMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        experiment_id: 'exp-1',
        cycle_id: CYCLE_ID,
      }),
      expect.any(Object)
    )
  })

  it('submits with budget override converted to cents', async () => {
    render(<CreateRunForm showId={SHOW_ID} cycleId={CYCLE_ID} />)
    fireEvent.click(screen.getByRole('button', { name: /pick experiment/i }))
    fireEvent.click(screen.getByRole('button', { name: /select email experiment/i }))

    fireEvent.change(screen.getByRole('spinbutton', { name: /budget override/i }), {
      target: { value: '250' },
    })

    fireEvent.click(screen.getByRole('button', { name: /create run/i }))

    await waitFor(() => expect(mockCreateRunMutate).toHaveBeenCalledOnce())
    expect(mockCreateRunMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        budget_cap_cents_override: 25000,
      }),
      expect.any(Object)
    )
  })

  it('submits with undefined budget_cap_cents_override when field empty', async () => {
    render(<CreateRunForm showId={SHOW_ID} cycleId={CYCLE_ID} />)
    fireEvent.click(screen.getByRole('button', { name: /pick experiment/i }))
    fireEvent.click(screen.getByRole('button', { name: /select email experiment/i }))

    fireEvent.click(screen.getByRole('button', { name: /create run/i }))

    await waitFor(() => expect(mockCreateRunMutate).toHaveBeenCalledOnce())
    const [payload] = mockCreateRunMutate.mock.calls[0]
    expect(payload.budget_cap_cents_override).toBeUndefined()
  })
})
