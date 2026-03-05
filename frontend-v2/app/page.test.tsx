import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ShowsPage from './page'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/features/shows/queries', () => ({
  useShows: vi.fn(),
  useCreateShow: vi.fn(),
}))

import { useShows, useCreateShow } from '@/features/shows/queries'
import type { components } from '@/shared/api/generated/schema'

const mockUseShows = vi.mocked(useShows)
const mockUseCreateShow = vi.mocked(useCreateShow)

const mockShow: components['schemas']['ShowResponse'] = {
  show_id: 'show-1' as unknown as components['schemas']['ShowResponse']['show_id'],
  artist_name: 'Radiohead',
  city: 'New York',
  venue: 'MSG',
  show_time: '2026-06-15T19:00:00Z',
  timezone: 'America/New_York',
  capacity: 10000,
  tickets_total: 10000,
  tickets_sold: 5000,
  currency: 'USD',
}

function makeMutation(overrides = {}) {
  return {
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
    ...overrides,
  }
}

describe('ShowsPage', () => {
  beforeEach(() => {
    mockUseCreateShow.mockReturnValue(makeMutation() as ReturnType<typeof useCreateShow>)
  })

  it('renders loading skeletons while loading', () => {
    mockUseShows.mockReturnValue({ isLoading: true, error: null, data: undefined } as ReturnType<typeof useShows>)
    render(<ShowsPage />)
    expect(screen.getByLabelText('Loading shows')).toBeInTheDocument()
  })

  it('renders error state', () => {
    mockUseShows.mockReturnValue({ isLoading: false, error: new Error('fail'), data: undefined } as ReturnType<typeof useShows>)
    render(<ShowsPage />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('renders empty state with CTA', () => {
    mockUseShows.mockReturnValue({ isLoading: false, error: null, data: [] } as ReturnType<typeof useShows>)
    render(<ShowsPage />)
    expect(screen.getByText(/no shows yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create your first show/i })).toBeInTheDocument()
  })

  it('renders a list of show cards', () => {
    mockUseShows.mockReturnValue({ isLoading: false, error: null, data: [mockShow] } as ReturnType<typeof useShows>)
    render(<ShowsPage />)
    expect(screen.getByText('Radiohead')).toBeInTheDocument()
  })

  it('opens modal when "New Show" is clicked', () => {
    mockUseShows.mockReturnValue({ isLoading: false, error: null, data: [] } as ReturnType<typeof useShows>)
    render(<ShowsPage />)
    fireEvent.click(screen.getByRole('button', { name: /new show/i }))
    expect(screen.getByRole('dialog', { name: /new show/i })).toBeInTheDocument()
  })

  it('closes modal on cancel', () => {
    mockUseShows.mockReturnValue({ isLoading: false, error: null, data: [] } as ReturnType<typeof useShows>)
    render(<ShowsPage />)
    fireEvent.click(screen.getByRole('button', { name: /new show/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('redirects to show page after successful creation', async () => {
    mockPush.mockClear()
    const newShow = { ...mockShow, show_id: 'new-show-id' }
    const mutateAsync = vi.fn().mockResolvedValue(newShow)
    mockUseCreateShow.mockReturnValue(makeMutation({ mutateAsync }) as ReturnType<typeof useCreateShow>)
    mockUseShows.mockReturnValue({ isLoading: false, error: null, data: [] } as ReturnType<typeof useShows>)

    render(<ShowsPage />)
    fireEvent.click(screen.getByRole('button', { name: /new show/i }))

    const form = screen.getByRole('dialog').querySelector('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/shows/new-show-id')
    })
  })
})
