import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SegmentList, SegmentListSkeleton } from './SegmentList'
import type { SegmentResponse } from '../api'

// Mock mutations used by SegmentCard and SegmentEditModal
vi.mock('../mutations', () => ({
  useApproveSegment: () => ({ mutate: vi.fn(), isPending: false }),
  useRejectSegment: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateSegment: () => ({ mutate: vi.fn(), isPending: false }),
}))

const SHOW_ID = 'show-1'

// Mock useSegments
vi.mock('../queries', () => ({
  useSegments: vi.fn(),
}))

import { useSegments } from '../queries'
const mockUseSegments = vi.mocked(useSegments)

const mockSegments: SegmentResponse[] = [
  {
    segment_id: 'seg-1',
    show_id: SHOW_ID,
    cycle_id: 'cycle-1',
    name: 'Gen Pop',
    definition_json: {},
    estimated_size: 5000,
    created_by: 'agent',
    review_status: 'pending',
    reviewed_at: null,
    reviewed_by: null,
  },
  {
    segment_id: 'seg-2',
    show_id: SHOW_ID,
    cycle_id: 'cycle-1',
    name: 'Rock Fans',
    definition_json: {},
    estimated_size: 2000,
    created_by: 'agent',
    review_status: 'approved',
    reviewed_at: '2026-03-05T12:00:00Z',
    reviewed_by: 'producer',
  },
]

function makeQueryResult(overrides: Partial<ReturnType<typeof useSegments>>) {
  return {
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useSegments>
}

describe('SegmentList', () => {
  it('renders loading skeleton when isPending', () => {
    mockUseSegments.mockReturnValue(makeQueryResult({ isPending: true }))
    render(<SegmentList showId={SHOW_ID} />)
    // SegmentListSkeleton renders 3 placeholders, all aria-hidden
    const skeletons = document.querySelectorAll('[aria-hidden="true"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders error banner on error', () => {
    mockUseSegments.mockReturnValue(makeQueryResult({ isError: true }))
    render(<SegmentList showId={SHOW_ID} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/failed to load segments/i)).toBeInTheDocument()
  })

  it('renders empty state when data is empty', () => {
    mockUseSegments.mockReturnValue(makeQueryResult({ data: [] }))
    render(<SegmentList showId={SHOW_ID} />)
    expect(screen.getByText(/no segments yet/i)).toBeInTheDocument()
    expect(screen.getByText(/run the strategy agent/i)).toBeInTheDocument()
  })

  it('renders one card per segment', () => {
    mockUseSegments.mockReturnValue(makeQueryResult({ data: mockSegments }))
    render(<SegmentList showId={SHOW_ID} />)
    expect(screen.getByText('Gen Pop')).toBeInTheDocument()
    expect(screen.getByText('Rock Fans')).toBeInTheDocument()
  })

  it('renders retry button in error banner', () => {
    const refetch = vi.fn()
    mockUseSegments.mockReturnValue(makeQueryResult({ isError: true, refetch }))
    render(<SegmentList showId={SHOW_ID} />)
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })
})

describe('SegmentListSkeleton', () => {
  it('renders 3 skeleton placeholder cards', () => {
    const { container } = render(<SegmentListSkeleton />)
    const items = container.querySelectorAll('li')
    expect(items).toHaveLength(3)
  })

  it('renders list with aria-hidden', () => {
    const { container } = render(<SegmentListSkeleton />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })
})
