import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FrameList, FrameListSkeleton } from './FrameList'
import type { FrameResponse } from '../api'

// Mock mutations and segment queries used by FrameCard and FrameEditModal
vi.mock('../mutations', () => ({
  useApproveFrame: () => ({ mutate: vi.fn(), isPending: false }),
  useRejectFrame: () => ({ mutate: vi.fn(), isPending: false }),
  useUndoFrameReview: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateFrame: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/features/segments/queries', () => ({
  useSegments: () => ({ data: [] }),
}))

// Mock useFrames
vi.mock('../queries', () => ({
  useFrames: vi.fn(),
}))

import { useFrames } from '../queries'
const mockUseFrames = vi.mocked(useFrames)

const SHOW_ID = 'show-1'

const mockFrames: FrameResponse[] = [
  {
    frame_id: 'frame-1',
    show_id: SHOW_ID,
    segment_id: 'seg-1',
    cycle_id: 'cycle-1',
    hypothesis: 'First hypothesis',
    promise: 'First promise',
    evidence_refs: [],
    channel: 'email',
    risk_notes: null,
    review_status: 'pending',
    reviewed_at: null,
    reviewed_by: null,
  },
  {
    frame_id: 'frame-2',
    show_id: SHOW_ID,
    segment_id: 'seg-1',
    cycle_id: 'cycle-1',
    hypothesis: 'Second hypothesis',
    promise: 'Second promise',
    evidence_refs: [],
    channel: 'social',
    risk_notes: null,
    review_status: 'approved',
    reviewed_at: '2026-03-05T12:00:00Z',
    reviewed_by: 'producer',
  },
]

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

describe('FrameList', () => {
  it('renders loading skeleton when isPending', () => {
    mockUseFrames.mockReturnValue(makeQueryResult({ isPending: true }))
    render(<FrameList showId={SHOW_ID} />)
    const skeletons = document.querySelectorAll('[aria-hidden="true"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders error banner on error', () => {
    mockUseFrames.mockReturnValue(makeQueryResult({ isError: true }))
    render(<FrameList showId={SHOW_ID} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/failed to load frames/i)).toBeInTheDocument()
  })

  it('renders retry button in error banner', () => {
    const refetch = vi.fn()
    mockUseFrames.mockReturnValue(makeQueryResult({ isError: true, refetch }))
    render(<FrameList showId={SHOW_ID} />)
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('renders empty state when data is empty', () => {
    mockUseFrames.mockReturnValue(makeQueryResult({ data: [] }))
    render(<FrameList showId={SHOW_ID} />)
    expect(screen.getByText(/no frames yet/i)).toBeInTheDocument()
    expect(screen.getByText(/run the strategy agent/i)).toBeInTheDocument()
  })

  it('renders one card per frame', () => {
    mockUseFrames.mockReturnValue(makeQueryResult({ data: mockFrames }))
    render(<FrameList showId={SHOW_ID} />)
    expect(screen.getByText('First hypothesis')).toBeInTheDocument()
    expect(screen.getByText('Second hypothesis')).toBeInTheDocument()
  })
})

describe('FrameListSkeleton', () => {
  it('renders 3 skeleton placeholder cards', () => {
    const { container } = render(<FrameListSkeleton />)
    const items = container.querySelectorAll('li')
    expect(items).toHaveLength(3)
  })

  it('renders list with aria-hidden', () => {
    const { container } = render(<FrameListSkeleton />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })
})
