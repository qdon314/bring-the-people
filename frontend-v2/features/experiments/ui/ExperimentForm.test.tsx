// Mock mutations before importing the component
const mockMutate = vi.fn()

vi.mock('../mutations', () => ({
  useCreateExperiment: () => ({
    mutate: mockMutate,
    isPending: false,
    error: null,
  }),
}))

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ExperimentForm } from './ExperimentForm'
import type { SegmentResponse } from '@/features/segments/api'
import type { FrameResponse } from '@/features/frames/api'

const SHOW_ID = 'show-1'
const CYCLE_ID = 'cycle-1'

const approvedSegments: SegmentResponse[] = [
  {
    segment_id: 'seg-1',
    show_id: SHOW_ID,
    cycle_id: CYCLE_ID,
    name: 'Gen Pop',
    definition_json: {},
    estimated_size: 5000,
    created_by: 'agent',
    review_status: 'approved',
    reviewed_at: '2026-03-05T12:00:00Z',
    reviewed_by: 'producer',
  },
]

const approvedFrames: FrameResponse[] = [
  {
    frame_id: 'frame-1',
    show_id: SHOW_ID,
    segment_id: 'seg-1',
    cycle_id: CYCLE_ID,
    hypothesis: 'Hypothesis for gen pop',
    promise: 'Promise for gen pop',
    evidence_refs: [],
    channel: 'email',
    risk_notes: null,
    review_status: 'approved',
    reviewed_at: '2026-03-05T12:00:00Z',
    reviewed_by: 'producer',
  },
  {
    frame_id: 'frame-2',
    show_id: SHOW_ID,
    segment_id: 'seg-2',
    cycle_id: CYCLE_ID,
    hypothesis: 'Hypothesis for other segment',
    promise: 'Promise for other segment',
    evidence_refs: [],
    channel: 'social',
    risk_notes: null,
    review_status: 'approved',
    reviewed_at: '2026-03-05T12:00:00Z',
    reviewed_by: 'producer',
  },
]

describe('ExperimentForm', () => {
  beforeEach(() => {
    mockMutate.mockReset()
  })

  it('shows message when no approved segments', () => {
    render(<ExperimentForm showId={SHOW_ID} cycleId={CYCLE_ID} approvedSegments={[]} approvedFrames={[]} />)
    expect(screen.getByText(/approve at least one segment/i)).toBeInTheDocument()
  })

  it('shows segment dropdown with approved segments', () => {
    render(
      <ExperimentForm
        showId={SHOW_ID}
        cycleId={CYCLE_ID}
        approvedSegments={approvedSegments}
        approvedFrames={approvedFrames}
      />
    )
    expect(screen.getByRole('combobox', { name: /segment/i })).toBeInTheDocument()
    expect(screen.getByText('Gen Pop')).toBeInTheDocument()
  })

  it('filters frames by selected segment', async () => {
    render(
      <ExperimentForm
        showId={SHOW_ID}
        cycleId={CYCLE_ID}
        approvedSegments={approvedSegments}
        approvedFrames={approvedFrames}
      />
    )

    const segmentSelect = screen.getByRole('combobox', { name: /segment/i })
    fireEvent.change(segmentSelect, { target: { value: 'seg-1' } })

    await waitFor(() => {
      const frameSelect = screen.getByRole('combobox', { name: /frame/i })
      expect(frameSelect).toBeInTheDocument()
    })
  })

  it('disables submit until all fields are filled', () => {
    render(
      <ExperimentForm
        showId={SHOW_ID}
        cycleId={CYCLE_ID}
        approvedSegments={approvedSegments}
        approvedFrames={approvedFrames}
      />
    )

    const submitButton = screen.getByRole('button', { name: /create experiment/i })
    expect(submitButton).toBeDisabled()
  })

  it('enables submit when all fields are filled', async () => {
    render(
      <ExperimentForm
        showId={SHOW_ID}
        cycleId={CYCLE_ID}
        approvedSegments={approvedSegments}
        approvedFrames={approvedFrames}
      />
    )

    const segmentSelect = screen.getByRole('combobox', { name: /segment/i })
    fireEvent.change(segmentSelect, { target: { value: 'seg-1' } })

    await waitFor(() => {
      const frameSelect = screen.getByRole('combobox', { name: /frame/i })
      fireEvent.change(frameSelect, { target: { value: 'frame-1' } })
    })

    const channelInput = screen.getByRole('textbox', { name: /channel/i })
    fireEvent.change(channelInput, { target: { value: 'email' } })

    const budgetInput = screen.getByRole('spinbutton', { name: /budget/i })
    fireEvent.change(budgetInput, { target: { value: '500' } })

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /create experiment/i })
      expect(submitButton).not.toBeDisabled()
    })
  })

  it('submits with budget converted to cents', async () => {
    render(
      <ExperimentForm
        showId={SHOW_ID}
        cycleId={CYCLE_ID}
        approvedSegments={approvedSegments}
        approvedFrames={approvedFrames}
      />
    )

    fireEvent.change(screen.getByRole('combobox', { name: /segment/i }), { target: { value: 'seg-1' } })
    await waitFor(() => {
      fireEvent.change(screen.getByRole('combobox', { name: /frame/i }), { target: { value: 'frame-1' } })
    })
    fireEvent.change(screen.getByRole('textbox', { name: /channel/i }), { target: { value: 'email' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: /budget/i }), { target: { value: '12.50' } })

    fireEvent.submit(screen.getByRole('button', { name: /create experiment/i }).closest('form')!)

    await waitFor(() => expect(mockMutate).toHaveBeenCalledOnce())
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ budgetCapCents: 1250 }),
      expect.any(Object)
    )
  })

  it('passes origin_cycle_id from prop', async () => {
    render(
      <ExperimentForm
        showId={SHOW_ID}
        cycleId={CYCLE_ID}
        approvedSegments={approvedSegments}
        approvedFrames={approvedFrames}
      />
    )

    fireEvent.change(screen.getByRole('combobox', { name: /segment/i }), { target: { value: 'seg-1' } })
    await waitFor(() => {
      fireEvent.change(screen.getByRole('combobox', { name: /frame/i }), { target: { value: 'frame-1' } })
    })
    fireEvent.change(screen.getByRole('textbox', { name: /channel/i }), { target: { value: 'email' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: /budget/i }), { target: { value: '100' } })

    fireEvent.submit(screen.getByRole('button', { name: /create experiment/i }).closest('form')!)

    await waitFor(() => expect(mockMutate).toHaveBeenCalledOnce())
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ originCycleId: CYCLE_ID }),
      expect.any(Object)
    )
  })

  it('shows "No approved frames" when selected segment has no matching frames', () => {
    render(
      <ExperimentForm
        showId={SHOW_ID}
        cycleId={CYCLE_ID}
        approvedSegments={approvedSegments}
        approvedFrames={approvedFrames}
      />
    )

    // seg-2 has no approved segments in approvedSegments list, but frame-2 belongs to seg-2
    // Select seg-1 — frame-2 (seg-2) should be filtered out
    fireEvent.change(screen.getByRole('combobox', { name: /segment/i }), { target: { value: 'seg-1' } })

    // Only frame-1 (seg-1) should be in the list; frame-2 (seg-2) filtered out
    expect(screen.queryByText(/hypothesis for other segment/i)).not.toBeInTheDocument()
  })

  it('clears frame selection when segment changes', async () => {
    const multiSegmentApproved = [
      ...approvedSegments,
      {
        segment_id: 'seg-2',
        show_id: SHOW_ID,
        cycle_id: CYCLE_ID,
        name: 'Rock Fans',
        definition_json: {},
        estimated_size: 2000,
        created_by: 'agent',
        review_status: 'approved' as const,
        reviewed_at: '2026-03-05T12:00:00Z',
        reviewed_by: 'producer',
      },
    ]

    render(
      <ExperimentForm
        showId={SHOW_ID}
        cycleId={CYCLE_ID}
        approvedSegments={multiSegmentApproved}
        approvedFrames={approvedFrames}
      />
    )

    // Select seg-1, then pick frame-1
    fireEvent.change(screen.getByRole('combobox', { name: /segment/i }), { target: { value: 'seg-1' } })
    await waitFor(() => {
      fireEvent.change(screen.getByRole('combobox', { name: /frame/i }), { target: { value: 'frame-1' } })
    })

    // Switch to seg-2 — frame selection should reset
    fireEvent.change(screen.getByRole('combobox', { name: /segment/i }), { target: { value: 'seg-2' } })

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /frame/i })).toHaveValue('')
    })
  })
})
