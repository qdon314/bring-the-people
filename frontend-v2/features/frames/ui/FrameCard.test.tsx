// Mock mutations before importing the component
vi.mock('../mutations', () => ({
  useApproveFrame: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useRejectFrame: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useUndoFrameReview: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useUpdateFrame: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}))

vi.mock('@/features/segments/queries', () => ({
  useSegments: () => ({
    data: [{ segment_id: 'seg-1', name: 'Gen Pop' }],
  }),
}))

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FrameCard } from './FrameCard'
import type { FrameResponse } from '../api'

const SHOW_ID = 'show-1'

const pendingFrame: FrameResponse = {
  frame_id: 'frame-1',
  show_id: SHOW_ID,
  segment_id: 'seg-1',
  cycle_id: 'cycle-1',
  hypothesis: 'Test hypothesis',
  promise: 'Test promise',
  evidence_refs: [],
  channel: 'email',
  risk_notes: null,
  review_status: 'pending',
  reviewed_at: null,
  reviewed_by: null,
}

const approvedFrame: FrameResponse = {
  ...pendingFrame,
  frame_id: 'frame-2',
  review_status: 'approved',
  reviewed_by: 'producer',
  reviewed_at: '2026-03-05T12:00:00Z',
}

const rejectedFrame: FrameResponse = {
  ...pendingFrame,
  frame_id: 'frame-3',
  review_status: 'rejected',
  reviewed_by: 'producer',
  reviewed_at: '2026-03-05T12:00:00Z',
}

describe('FrameCard', () => {
  it('renders pending frame with approve/reject buttons', () => {
    render(<FrameCard frame={pendingFrame} showId={SHOW_ID} />)
    expect(screen.getByText('Test hypothesis')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
  })

  it('renders approved frame with Undo button', () => {
    render(<FrameCard frame={approvedFrame} showId={SHOW_ID} />)
    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /undo review/i })).toBeInTheDocument()
  })

  it('renders rejected frame with Undo button', () => {
    render(<FrameCard frame={rejectedFrame} showId={SHOW_ID} />)
    expect(screen.getByText('Rejected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /undo review/i })).toBeInTheDocument()
  })

  it('shows linked segment name', () => {
    render(<FrameCard frame={pendingFrame} showId={SHOW_ID} />)
    expect(screen.getByText(/gen pop/i)).toBeInTheDocument()
  })

  it('shows confirmation dialog when reject button clicked', () => {
    render(<FrameCard frame={pendingFrame} showId={SHOW_ID} />)
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    expect(screen.getByRole('dialog', { name: /reject frame/i })).toBeInTheDocument()
  })
})
