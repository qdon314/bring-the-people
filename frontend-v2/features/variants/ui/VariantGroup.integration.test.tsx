import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VariantGroup, VariantGroupSkeleton } from './VariantGroup'
import type { VariantResponse } from '../api'

// Mock mutations used by VariantCard
const mockApprove = vi.fn()
const mockReject = vi.fn()
const mockUndo = vi.fn()

vi.mock('../mutations', () => ({
  useApproveVariant: () => ({ mutate: mockApprove, isPending: false }),
  useRejectVariant: () => ({ mutate: mockReject, isPending: false }),
  useUndoVariantReview: () => ({ mutate: mockUndo, isPending: false }),
  useUpdateVariant: () => ({ mutate: vi.fn(), isPending: false }),
}))

// Mock useVariants
vi.mock('../queries', () => ({
  useVariants: vi.fn(),
}))

import { useVariants } from '../queries'
const mockUseVariants = vi.mocked(useVariants)

const FRAME_ID = 'frame-1'

const instagramVariant: VariantResponse = {
  variant_id: 'var-1',
  frame_id: FRAME_ID,
  cycle_id: 'cycle-1',
  platform: 'Instagram',
  hook: 'Summer vibes await',
  body: 'Join us for an unforgettable night.',
  cta: 'Get tickets',
  constraints_passed: true,
  review_status: 'pending',
  reviewed_at: null,
  reviewed_by: null,
}

const twitterVariant: VariantResponse = {
  variant_id: 'var-2',
  frame_id: FRAME_ID,
  cycle_id: 'cycle-1',
  platform: 'Twitter',
  hook: 'Don\'t miss out',
  body: 'The hottest show in town.',
  cta: 'Buy now',
  constraints_passed: true,
  review_status: 'pending',
  reviewed_at: null,
  reviewed_by: null,
}

const approvedVariant: VariantResponse = {
  ...instagramVariant,
  variant_id: 'var-3',
  review_status: 'approved',
  reviewed_by: 'producer',
  reviewed_at: '2026-03-05T12:00:00Z',
}

function makeQueryResult(overrides: Partial<ReturnType<typeof useVariants>>) {
  return {
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useVariants>
}

describe('VariantGroup', () => {
  beforeEach(() => {
    mockApprove.mockReset()
    mockReject.mockReset()
    mockUndo.mockReset()
  })

  it('shows skeleton while loading', () => {
    mockUseVariants.mockReturnValue(makeQueryResult({ isPending: true }))
    render(<VariantGroup frameId={FRAME_ID} />)
    const skeletons = document.querySelectorAll('[aria-hidden="true"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows error banner on error', () => {
    mockUseVariants.mockReturnValue(makeQueryResult({ isError: true }))
    render(<VariantGroup frameId={FRAME_ID} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/failed to load variants/i)).toBeInTheDocument()
  })

  it('shows empty state when no variants returned', () => {
    mockUseVariants.mockReturnValue(makeQueryResult({ data: [] }))
    render(<VariantGroup frameId={FRAME_ID} />)
    expect(screen.getByText(/no variants yet/i)).toBeInTheDocument()
    expect(screen.getByText(/generate variants/i)).toBeInTheDocument()
  })

  it('renders variants grouped by platform with section headings', () => {
    mockUseVariants.mockReturnValue(
      makeQueryResult({ data: [instagramVariant, twitterVariant] })
    )
    render(<VariantGroup frameId={FRAME_ID} />)

    // Both platform headings should appear as h3 elements
    const headings = screen.getAllByRole('heading', { level: 3 })
    const headingTexts = headings.map((h) => h.textContent)
    expect(headingTexts).toContain('Instagram')
    expect(headingTexts).toContain('Twitter')

    // Both variant hooks should appear
    expect(screen.getByText('Summer vibes await')).toBeInTheDocument()
    expect(screen.getByText("Don't miss out")).toBeInTheDocument()
  })

  it('groups multiple variants under same platform heading', () => {
    const secondInstagram: VariantResponse = {
      ...instagramVariant,
      variant_id: 'var-4',
      hook: 'Another Instagram ad',
    }
    mockUseVariants.mockReturnValue(
      makeQueryResult({ data: [instagramVariant, secondInstagram] })
    )
    render(<VariantGroup frameId={FRAME_ID} />)

    // Only one Instagram h3 heading
    const headings = screen.getAllByRole('heading', { level: 3 })
    const instagramHeadings = headings.filter((h) => h.textContent === 'Instagram')
    expect(instagramHeadings).toHaveLength(1)

    // Both variant hooks visible
    expect(screen.getByText('Summer vibes await')).toBeInTheDocument()
    expect(screen.getByText('Another Instagram ad')).toBeInTheDocument()
  })

  it('approve button calls approve mutation with variant ID', () => {
    mockUseVariants.mockReturnValue(
      makeQueryResult({ data: [instagramVariant] })
    )
    render(<VariantGroup frameId={FRAME_ID} />)
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    expect(mockApprove).toHaveBeenCalledWith(
      expect.objectContaining({ variantId: instagramVariant.variant_id }),
      expect.any(Object)
    )
  })

  it('reject button opens confirm dialog', () => {
    mockUseVariants.mockReturnValue(
      makeQueryResult({ data: [instagramVariant] })
    )
    render(<VariantGroup frameId={FRAME_ID} />)
    fireEvent.click(screen.getByRole('button', { name: /^reject$/i }))
    expect(screen.getByRole('dialog', { name: /reject variant/i })).toBeInTheDocument()
  })

  it('confirming reject dialog calls reject mutation', () => {
    mockUseVariants.mockReturnValue(
      makeQueryResult({ data: [instagramVariant] })
    )
    render(<VariantGroup frameId={FRAME_ID} />)
    fireEvent.click(screen.getByRole('button', { name: /^reject$/i }))
    fireEvent.click(screen.getByRole('button', { name: /reject variant/i }))
    expect(mockReject).toHaveBeenCalledWith(
      expect.objectContaining({ variantId: instagramVariant.variant_id }),
      expect.any(Object)
    )
  })

  it('does not call reject mutation before dialog is confirmed', () => {
    mockUseVariants.mockReturnValue(
      makeQueryResult({ data: [instagramVariant] })
    )
    render(<VariantGroup frameId={FRAME_ID} />)
    fireEvent.click(screen.getByRole('button', { name: /^reject$/i }))
    expect(mockReject).not.toHaveBeenCalled()
  })

  it('shows approved status badge for approved variant', () => {
    mockUseVariants.mockReturnValue(
      makeQueryResult({ data: [approvedVariant] })
    )
    render(<VariantGroup frameId={FRAME_ID} />)
    expect(screen.getByText('Approved')).toBeInTheDocument()
  })

  it('shows undo button for approved variant', () => {
    mockUseVariants.mockReturnValue(
      makeQueryResult({ data: [approvedVariant] })
    )
    render(<VariantGroup frameId={FRAME_ID} />)
    expect(screen.getByRole('button', { name: /undo review/i })).toBeInTheDocument()
  })

  it('shows constraints failed warning when constraints_passed is false', () => {
    const failedVariant: VariantResponse = {
      ...instagramVariant,
      constraints_passed: false,
    }
    mockUseVariants.mockReturnValue(makeQueryResult({ data: [failedVariant] }))
    render(<VariantGroup frameId={FRAME_ID} />)
    expect(screen.getByText(/constraints failed/i)).toBeInTheDocument()
  })
})

describe('VariantGroupSkeleton', () => {
  it('renders 3 skeleton placeholder cards', () => {
    const { container } = render(<VariantGroupSkeleton />)
    const items = container.querySelectorAll('li')
    expect(items).toHaveLength(3)
  })

  it('renders list with aria-hidden', () => {
    const { container } = render(<VariantGroupSkeleton />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })
})
