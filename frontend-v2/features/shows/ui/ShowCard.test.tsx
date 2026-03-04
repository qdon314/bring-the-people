import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShowCard } from './ShowCard'
import type { components } from '@/shared/api/generated/schema'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

const mockShow: components['schemas']['ShowResponse'] = {
  show_id: 'show-123' as unknown as components['schemas']['ShowResponse']['show_id'],
  artist_name: 'Radiohead',
  city: 'New York',
  venue: 'Madison Square Garden',
  show_time: '2026-06-15T19:00:00Z',
  timezone: 'America/New_York',
  capacity: 10000,
  tickets_total: 10000,
  tickets_sold: 7500,
  currency: 'USD',
}

describe('ShowCard', () => {
  it('renders artist name', () => {
    render(<ShowCard show={mockShow} />)
    expect(screen.getByText('Radiohead')).toBeInTheDocument()
  })

  it('renders city and venue', () => {
    render(<ShowCard show={mockShow} />)
    expect(screen.getByText('Madison Square Garden, New York')).toBeInTheDocument()
  })

  it('renders ticket sales', () => {
    render(<ShowCard show={mockShow} />)
    expect(screen.getByText('7,500/10,000')).toBeInTheDocument()
  })

  it('renders sold percentage', () => {
    render(<ShowCard show={mockShow} />)
    expect(screen.getByText('75% sold')).toBeInTheDocument()
  })

  it('links to the show page', () => {
    render(<ShowCard show={mockShow} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/shows/show-123')
  })

  it('shows 0% sold when tickets_total is 0', () => {
    render(<ShowCard show={{ ...mockShow, tickets_total: 0, tickets_sold: 0 }} />)
    expect(screen.getByText('0% sold')).toBeInTheDocument()
  })
})
