import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SegmentCard, SegmentCardSkeleton } from './SegmentCard'
import type { SegmentResponse } from '../api'

// Mock mutations
const mockApprove = vi.fn()
const mockReject = vi.fn()

vi.mock('../mutations', () => ({
  useApproveSegment: () => ({
    mutate: mockApprove,
    isPending: false,
  }),
  useRejectSegment: () => ({
    mutate: mockReject,
    isPending: false,
  }),
}))

const SHOW_ID = 'show-1'

const pendingSegment: SegmentResponse = {
  segment_id: 'seg-1',
  show_id: SHOW_ID,
  cycle_id: 'cycle-1',
  name: 'Gen Pop',
  definition_json: { age_range: '18-35', location: 'Austin' },
  estimated_size: 5000,
  created_by: 'agent',
  review_status: 'pending',
  reviewed_at: null,
  reviewed_by: null,
}

const approvedSegment: SegmentResponse = {
  ...pendingSegment,
  segment_id: 'seg-2',
  review_status: 'approved',
  reviewed_by: 'producer',
  reviewed_at: '2026-03-05T12:00:00Z',
}

const rejectedSegment: SegmentResponse = {
  ...pendingSegment,
  segment_id: 'seg-3',
  review_status: 'rejected',
  reviewed_by: 'producer',
  reviewed_at: '2026-03-05T13:00:00Z',
}

function renderCard(segment: SegmentResponse = pendingSegment) {
  return render(<SegmentCard segment={segment} showId={SHOW_ID} />)
}

describe('SegmentCard', () => {
  beforeEach(() => {
    mockApprove.mockReset()
    mockReject.mockReset()
  })

  describe('pending state', () => {
    it('renders segment name', () => {
      renderCard(pendingSegment)
      expect(screen.getByText('Gen Pop')).toBeInTheDocument()
    })

    it('renders status badge with Pending', () => {
      renderCard(pendingSegment)
      expect(screen.getByText('Pending')).toBeInTheDocument()
    })

    it('renders estimated size', () => {
      renderCard(pendingSegment)
      expect(screen.getByText(/5,000/)).toBeInTheDocument()
    })

    it('renders Edit button on pending cards', () => {
      renderCard(pendingSegment)
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    })

    it('renders Approve and Reject buttons', () => {
      renderCard(pendingSegment)
      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
    })

    it('Approve and Reject buttons are enabled', () => {
      renderCard(pendingSegment)
      expect(screen.getByRole('button', { name: /approve/i })).not.toBeDisabled()
      expect(screen.getByRole('button', { name: /reject/i })).not.toBeDisabled()
    })
  })

  describe('approved state', () => {
    it('renders Approved badge', () => {
      renderCard(approvedSegment)
      expect(screen.getByText('Approved')).toBeInTheDocument()
    })

    it('shows reviewed_by and reviewed_at', () => {
      renderCard(approvedSegment)
      expect(screen.getByText(/producer/)).toBeInTheDocument()
    })

    it('disables Approve and Reject buttons', () => {
      renderCard(approvedSegment)
      expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /reject/i })).toBeDisabled()
    })

    it('does not render Edit button', () => {
      renderCard(approvedSegment)
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
    })
  })

  describe('rejected state', () => {
    it('renders Rejected badge', () => {
      renderCard(rejectedSegment)
      expect(screen.getByText('Rejected')).toBeInTheDocument()
    })

    it('disables Approve and Reject buttons', () => {
      renderCard(rejectedSegment)
      expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /reject/i })).toBeDisabled()
    })

    it('does not render Edit button', () => {
      renderCard(rejectedSegment)
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
    })
  })

  describe('definition JSON preview', () => {
    it('shows "Show definition" toggle button', () => {
      renderCard(pendingSegment)
      expect(screen.getByRole('button', { name: /show definition/i })).toBeInTheDocument()
    })

    it('reveals JSON content when toggled', () => {
      renderCard(pendingSegment)
      fireEvent.click(screen.getByRole('button', { name: /show definition/i }))
      expect(screen.getByText(/age_range/)).toBeInTheDocument()
    })

    it('collapses JSON when toggled again', () => {
      renderCard(pendingSegment)
      fireEvent.click(screen.getByRole('button', { name: /show definition/i }))
      fireEvent.click(screen.getByRole('button', { name: /hide definition/i }))
      expect(screen.queryByText(/age_range/)).not.toBeInTheDocument()
    })
  })

  describe('approve action', () => {
    it('calls approve mutation with segment ID on click', () => {
      renderCard(pendingSegment)
      fireEvent.click(screen.getByRole('button', { name: /approve/i }))
      expect(mockApprove).toHaveBeenCalledWith(
        expect.objectContaining({ segmentId: pendingSegment.segment_id }),
        expect.any(Object)
      )
    })
  })

  describe('reject action with confirmation', () => {
    it('opens reject dialog when Reject is clicked', () => {
      renderCard(pendingSegment)
      fireEvent.click(screen.getByRole('button', { name: /^reject$/i }))
      expect(screen.getByRole('dialog', { name: /reject segment/i })).toBeInTheDocument()
    })

    it('does not call reject mutation before dialog is confirmed', () => {
      renderCard(pendingSegment)
      fireEvent.click(screen.getByRole('button', { name: /^reject$/i }))
      expect(mockReject).not.toHaveBeenCalled()
    })

    it('calls reject mutation when dialog confirm is clicked', () => {
      renderCard(pendingSegment)
      fireEvent.click(screen.getByRole('button', { name: /^reject$/i }))
      fireEvent.click(screen.getByRole('button', { name: /reject segment/i }))
      expect(mockReject).toHaveBeenCalledWith(
        expect.objectContaining({ segmentId: pendingSegment.segment_id }),
        expect.any(Object)
      )
    })

    it('closes dialog when Cancel is clicked without calling mutation', () => {
      renderCard(pendingSegment)
      fireEvent.click(screen.getByRole('button', { name: /^reject$/i }))
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
      expect(mockReject).not.toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('includes reason in reject mutation call', () => {
      renderCard(pendingSegment)
      fireEvent.click(screen.getByRole('button', { name: /^reject$/i }))
      const textarea = screen.getByLabelText(/reason/i)
      fireEvent.change(textarea, { target: { value: 'Too broad' } })
      fireEvent.click(screen.getByRole('button', { name: /reject segment/i }))
      expect(mockReject).toHaveBeenCalledWith(
        expect.objectContaining({ notes: 'Too broad' }),
        expect.any(Object)
      )
    })
  })
})

describe('SegmentCardSkeleton', () => {
  it('renders skeleton with aria-hidden', () => {
    const { container } = render(<SegmentCardSkeleton />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders with animate-pulse class', () => {
    const { container } = render(<SegmentCardSkeleton />)
    expect(container.firstChild).toHaveClass('animate-pulse')
  })
})
