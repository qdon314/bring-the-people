// Mock modules before imports (hoisted by Vitest)
const mockUseFrames = vi.fn()
const mockUseSegments = vi.fn()
const mockUseVariants = vi.fn()
const mockRunCreativeMutate = vi.fn()
const mockApprove = vi.fn()
const mockReject = vi.fn()
const mockUndo = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/features/frames/queries', () => ({
  useFrames: () => mockUseFrames(),
}))

vi.mock('@/features/segments/queries', () => ({
  useSegments: () => mockUseSegments(),
}))

vi.mock('@/features/variants/queries', () => ({
  useVariants: (frameId: string) => mockUseVariants(frameId),
}))

vi.mock('@/features/creative/mutations', () => ({
  useRunCreative: () => ({
    mutateAsync: mockRunCreativeMutate,
    isPending: false,
  }),
}))

vi.mock('@/features/variants/mutations', () => ({
  useApproveVariant: () => ({ mutate: mockApprove, isPending: false }),
  useRejectVariant: () => ({ mutate: mockReject, isPending: false }),
  useUndoVariantReview: () => ({ mutate: mockUndo, isPending: false }),
  useUpdateVariant: () => ({ mutate: mockUpdate, isPending: false, mutateAsync: mockUpdate }),
}))

vi.mock('@/features/jobs/useJobPolling', () => ({
  useJobPolling: () => ({
    data: { status: 'completed' },
    isPending: false,
  }),
}))

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CreatePage from './page'
import type { FrameResponse } from '@/features/frames/api'
import type { SegmentResponse } from '@/features/segments/api'
import type { VariantResponse } from '@/features/variants/api'

// Wrapper to provide QueryClient
function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return Wrapper
}

const SHOW_ID = 'show-1'
const CYCLE_ID = 'cycle-1'

const approvedFrame1: FrameResponse = {
  frame_id: 'frame-1',
  show_id: SHOW_ID,
  segment_id: 'seg-1',
  cycle_id: CYCLE_ID,
  hypothesis: 'Frame One Hypothesis',
  promise: 'Promise one',
  evidence_refs: [],
  channel: 'email',
  risk_notes: null,
  review_status: 'approved',
  reviewed_at: '2026-03-06T10:00:00Z',
  reviewed_by: 'producer',
}

const approvedFrame2: FrameResponse = {
  frame_id: 'frame-2',
  show_id: SHOW_ID,
  segment_id: 'seg-1',
  cycle_id: CYCLE_ID,
  hypothesis: 'Frame Two Hypothesis',
  promise: 'Promise two',
  evidence_refs: [],
  channel: 'social',
  risk_notes: null,
  review_status: 'approved',
  reviewed_at: '2026-03-06T11:00:00Z',
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
  reviewed_at: '2026-03-06T09:00:00Z',
  reviewed_by: 'producer',
}

const variantFrame1: VariantResponse = {
  variant_id: 'var-1',
  frame_id: 'frame-1',
  cycle_id: CYCLE_ID,
  platform: 'Instagram',
  hook: 'Variant hook',
  body: 'Variant body',
  cta: 'Get tickets',
  constraints_passed: true,
  review_status: 'pending',
  reviewed_at: null,
  reviewed_by: null,
  edited_by_human: false,
}

describe('CreatePage', () => {
  beforeEach(() => {
    mockRunCreativeMutate.mockReset()
    mockApprove.mockReset()
    mockReject.mockReset()
    mockUndo.mockReset()
    mockUpdate.mockReset()

    // Default mocks
    mockUseFrames.mockReturnValue({
      data: [approvedFrame1, approvedFrame2],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    })

    mockUseSegments.mockReturnValue({
      data: [segment1],
      isPending: false,
      isError: false,
    })

    mockUseVariants.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    })
  })

  it('renders page title and description', () => {
    render(<CreatePage params={{ show_id: SHOW_ID, cycle_id: CYCLE_ID }} />, { wrapper: makeWrapper() })
    expect(screen.getByRole('heading', { name: /create/i, level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/generate and review creative variants/i)).toBeInTheDocument()
  })

  it('renders FramePicker section with frames', () => {
    render(<CreatePage params={{ show_id: SHOW_ID, cycle_id: CYCLE_ID }} />, { wrapper: makeWrapper() })
    expect(screen.getByText(/select frames/i)).toBeInTheDocument()
    expect(screen.getByText('Frame One Hypothesis')).toBeInTheDocument()
    expect(screen.getByText('Frame Two Hypothesis')).toBeInTheDocument()
  })

  it('renders loading state when frames are loading', () => {
    mockUseFrames.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch: vi.fn(),
    })

    render(<CreatePage params={{ show_id: SHOW_ID, cycle_id: CYCLE_ID }} />, { wrapper: makeWrapper() })
    
    // FramePicker should show skeleton
    expect(screen.getByRole('heading', { name: /select frames/i })).toBeInTheDocument()
  })

  it('does not show queue section when no jobs are running', () => {
    render(<CreatePage params={{ show_id: SHOW_ID, cycle_id: CYCLE_ID }} />, { wrapper: makeWrapper() })
    expect(screen.queryByText(/generation queue/i)).not.toBeInTheDocument()
  })

  it('does not show review section when no frames have completed', () => {
    render(<CreatePage params={{ show_id: SHOW_ID, cycle_id: CYCLE_ID }} />, { wrapper: makeWrapper() })
    expect(screen.queryByText(/review variants/i)).not.toBeInTheDocument()
  })
})
