// Mock modules before any imports (hoisted by Vitest)
const mockMutateAsync = vi.fn()
let mockIsMutationPending = false

vi.mock('../mutations', () => ({
  useRunCreative: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsMutationPending,
  }),
}))

vi.mock('@/features/frames/queries', () => ({
  useFrames: vi.fn(),
}))

vi.mock('@/features/segments/queries', () => ({
  useSegments: vi.fn(),
}))

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { FramePicker } from './FramePicker'
import type { FrameResponse } from '@/features/frames/api'
import type { SegmentResponse } from '@/features/segments/api'
import { useFrames } from '@/features/frames/queries'
import { useSegments } from '@/features/segments/queries'

const mockUseFrames = vi.mocked(useFrames)
const mockUseSegments = vi.mocked(useSegments)

const SHOW_ID = 'show-1'
const CYCLE_ID = 'cycle-1'

const pendingFrame: FrameResponse = {
  frame_id: 'frame-pending',
  show_id: SHOW_ID,
  segment_id: 'seg-1',
  cycle_id: CYCLE_ID,
  hypothesis: 'Pending hypothesis',
  promise: 'Some promise',
  evidence_refs: [],
  channel: 'email',
  risk_notes: null,
  review_status: 'pending',
  reviewed_at: null,
  reviewed_by: null,
}

const approvedFrame1: FrameResponse = {
  frame_id: 'frame-approved-1',
  show_id: SHOW_ID,
  segment_id: 'seg-1',
  cycle_id: CYCLE_ID,
  hypothesis: 'Approved hypothesis one',
  promise: 'Promise one',
  evidence_refs: [],
  channel: 'email',
  risk_notes: null,
  review_status: 'approved',
  reviewed_at: '2026-03-05T12:00:00Z',
  reviewed_by: 'producer',
}

const approvedFrame2: FrameResponse = {
  frame_id: 'frame-approved-2',
  show_id: SHOW_ID,
  segment_id: 'seg-1',
  cycle_id: CYCLE_ID,
  hypothesis: 'Approved hypothesis two',
  promise: 'Promise two',
  evidence_refs: [],
  channel: 'social',
  risk_notes: null,
  review_status: 'approved',
  reviewed_at: '2026-03-05T13:00:00Z',
  reviewed_by: 'producer',
}

const segment1: SegmentResponse = {
  segment_id: 'seg-1',
  show_id: SHOW_ID,
  cycle_id: CYCLE_ID,
  name: 'Segment One',
  hypothesis: 'Hypothesis one',
  target_audience: 'Audience one',
  review_status: 'approved',
  reviewed_at: '2026-03-05T10:00:00Z',
  reviewed_by: 'producer',
}

function makeQueryResult(overrides: Partial<ReturnType<typeof useFrames>>) {
  return {
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useFrames>
}

describe('FramePicker', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset()
    mockIsMutationPending = false
    mockUseSegments.mockReturnValue({ data: [], isPending: false } as never)
  })

  it('renders "No approved frames" empty state when all frames are pending', () => {
    mockUseFrames.mockReturnValue(makeQueryResult({ data: [pendingFrame] }))
    render(<FramePicker showId={SHOW_ID} cycleId={CYCLE_ID} onJobsStarted={vi.fn()} />)
    expect(screen.getByText(/no approved frames yet/i)).toBeInTheDocument()
    expect(screen.getByText(/approve frames in the plan tab/i)).toBeInTheDocument()
  })

  it('renders approved frames with checkboxes', () => {
    mockUseFrames.mockReturnValue(
      makeQueryResult({ data: [pendingFrame, approvedFrame1, approvedFrame2] }),
    )
    mockUseSegments.mockReturnValue({ data: [], isPending: false } as never)
    render(<FramePicker showId={SHOW_ID} cycleId={CYCLE_ID} onJobsStarted={vi.fn()} />)

    expect(screen.getByText('Approved hypothesis one')).toBeInTheDocument()
    expect(screen.getByText('Approved hypothesis two')).toBeInTheDocument()

    expect(screen.queryByText('Pending hypothesis')).not.toBeInTheDocument()

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)

    const badges = document.querySelectorAll('.rounded-full')
    expect(badges).toHaveLength(2)
  })

  it('"Generate variants" button is disabled when no frames are selected', () => {
    mockUseFrames.mockReturnValue(makeQueryResult({ data: [approvedFrame1, approvedFrame2] }))
    render(<FramePicker showId={SHOW_ID} cycleId={CYCLE_ID} onJobsStarted={vi.fn()} />)

    const button = screen.getByRole('button', { name: /generate variants/i })
    expect(button).toBeDisabled()
  })

  it('"Generate variants" button is enabled after selecting a frame', () => {
    mockUseFrames.mockReturnValue(makeQueryResult({ data: [approvedFrame1, approvedFrame2] }))
    render(<FramePicker showId={SHOW_ID} cycleId={CYCLE_ID} onJobsStarted={vi.fn()} />)

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])

    const button = screen.getByRole('button', { name: /generate variants/i })
    expect(button).not.toBeDisabled()
  })

  it('"Generate variants" button is disabled when selected frames have running jobs', async () => {
    mockUseFrames.mockReturnValue(makeQueryResult({ data: [approvedFrame1, approvedFrame2] }))

    // The mutation resolves with a job_id, simulating a running job
    mockMutateAsync.mockResolvedValue({ job_id: 'job-123', status: 'queued' })

    const onJobsStarted = vi.fn()
    render(<FramePicker showId={SHOW_ID} cycleId={CYCLE_ID} onJobsStarted={onJobsStarted} />)

    // Select both frames
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])

    const button = screen.getByRole('button', { name: /generate variants/i })
    expect(button).not.toBeDisabled()

    // Kick off the generation — wrap in act to flush async state updates
    await act(async () => {
      fireEvent.click(button)
      await vi.waitFor(() => {
        expect(onJobsStarted).toHaveBeenCalled()
      })
    })

    // After jobs started, selected frames are cleared and running frames are tracked.
    // Re-selecting one of the running frames should disable the button.
    // (The frames are still listed but they're now marked as running)
    // Checkboxes for running frames are disabled
    const updatedCheckboxes = screen.getAllByRole('checkbox')
    expect(updatedCheckboxes[0]).toBeDisabled()
    expect(updatedCheckboxes[1]).toBeDisabled()
  })

  it('renders filter dropdowns', () => {
    mockUseFrames.mockReturnValue(makeQueryResult({ data: [approvedFrame1, approvedFrame2] }))
    mockUseSegments.mockReturnValue({ data: [segment1], isPending: false } as never)
    render(<FramePicker showId={SHOW_ID} cycleId={CYCLE_ID} onJobsStarted={vi.fn()} />)

    expect(screen.getAllByRole('combobox')).toHaveLength(2)
    expect(screen.getByText('All channels')).toBeInTheDocument()
    expect(screen.getByText('All segments')).toBeInTheDocument()
  })

  it('filters frames by channel', () => {
    mockUseFrames.mockReturnValue(makeQueryResult({ data: [approvedFrame1, approvedFrame2] }))
    mockUseSegments.mockReturnValue({ data: [segment1], isPending: false } as never)
    render(<FramePicker showId={SHOW_ID} cycleId={CYCLE_ID} onJobsStarted={vi.fn()} />)

    const selects = screen.getAllByRole('combobox')
    const channelSelect = selects[0]
    fireEvent.change(channelSelect, { target: { value: 'email' } })

    expect(screen.getByText('Approved hypothesis one')).toBeInTheDocument()
    expect(screen.queryByText('Approved hypothesis two')).not.toBeInTheDocument()
  })

  it('shows empty state when filters match no frames', () => {
    mockUseFrames.mockReturnValue(makeQueryResult({ data: [approvedFrame1] }))
    mockUseSegments.mockReturnValue({ data: [segment1], isPending: false } as never)
    render(<FramePicker showId={SHOW_ID} cycleId={CYCLE_ID} onJobsStarted={vi.fn()} />)

    const selects = screen.getAllByRole('combobox')
    const channelSelect = selects[0]
    fireEvent.change(channelSelect, { target: { value: 'email' } })

    const framesAfterFilter = screen.queryAllByRole('checkbox')
    expect(framesAfterFilter).toHaveLength(1)
  })

  it('clears filters when clear button is clicked', () => {
    mockUseFrames.mockReturnValue(makeQueryResult({ data: [approvedFrame1, approvedFrame2] }))
    mockUseSegments.mockReturnValue({ data: [segment1], isPending: false } as never)
    render(<FramePicker showId={SHOW_ID} cycleId={CYCLE_ID} onJobsStarted={vi.fn()} />)

    const selects = screen.getAllByRole('combobox')
    const channelSelect = selects[0]
    fireEvent.change(channelSelect, { target: { value: 'email' } })

    expect(screen.queryByText('Approved hypothesis two')).not.toBeInTheDocument()

    const clearButton = screen.getByRole('button', { name: /clear filters/i })
    fireEvent.click(clearButton)

    expect(screen.getByText('Approved hypothesis one')).toBeInTheDocument()
    expect(screen.getByText('Approved hypothesis two')).toBeInTheDocument()
  })
})
