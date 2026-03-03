import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppShell, AppShellSkeleton, TopBar, TopBarSkeleton } from './index'
import type { components } from '@/shared/api/generated/schema'

// Mock types
const mockShow: components['schemas']['ShowResponse'] = {
  show_id: 'show-123',
  artist_name: 'Test Artist',
  city: 'New York',
  venue: 'Madison Square Garden',
  show_time: '2026-06-15T19:00:00Z',
  timezone: 'America/New_York',
  capacity: 10000,
  tickets_total: 10000,
  tickets_sold: 5000,
  currency: 'USD',
}

const mockCycle: components['schemas']['CycleResponse'] = {
  cycle_id: 'cycle-456',
  show_id: 'show-123',
  started_at: '2026-03-01T10:00:00Z',
  label: 'Week 1',
}

describe('AppShell', () => {
  it('renders children', () => {
    render(
      <AppShell showId="show-123" cycleId="cycle-456">
        <div data-testid="child-content">Test Content</div>
      </AppShell>
    )

    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })

  it('renders TopBar with show data', () => {
    render(
      <AppShell 
        showId="show-123" 
        cycleId="cycle-456"
        show={mockShow}
        cycle={mockCycle}
      >
        <div>Content</div>
      </AppShell>
    )

    expect(screen.getByText('Test Artist')).toBeInTheDocument()
  })

  it('renders loading skeleton when isLoading is true', () => {
    render(
      <AppShell 
        showId="show-123" 
        cycleId="cycle-456"
        isLoading={true}
      >
        <div>Content</div>
      </AppShell>
    )

    // Should render skeleton elements
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders error state when error is provided', () => {
    render(
      <AppShell 
        showId="show-123" 
        cycleId="cycle-456"
        error={new Error('Failed to load')}
      >
        <div>Content</div>
      </AppShell>
    )

    expect(screen.getByText(/Failed to load show data/i)).toBeInTheDocument()
  })

  it('renders sidebar', () => {
    render(
      <AppShell showId="show-123" cycleId="cycle-456">
        <div>Content</div>
      </AppShell>
    )

    // Sidebar should have navigation items
    const nav = document.querySelector('nav')
    expect(nav).toBeInTheDocument()
  })
})

describe('AppShellSkeleton', () => {
  it('renders skeleton layout', () => {
    render(<AppShellSkeleton />)

    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders children when provided', () => {
    render(
      <AppShellSkeleton>
        <div data-testid="child">Child Content</div>
      </AppShellSkeleton>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
  })
})

describe('TopBar', () => {
  it('renders show name', () => {
    render(<TopBar show={mockShow} cycle={mockCycle} />)

    expect(screen.getByText('Test Artist')).toBeInTheDocument()
  })

  it('renders days until show label', () => {
    render(<TopBar show={mockShow} cycle={mockCycle} />)

    // Should show the label for days until
    expect(screen.getByText('Days until show')).toBeInTheDocument()
  })

  it('renders ticket sales progress', () => {
    render(<TopBar show={mockShow} cycle={mockCycle} />)

    expect(screen.getByText(/5000\/10000/)).toBeInTheDocument()
  })

  it('renders phase badge', () => {
    render(<TopBar show={mockShow} cycle={mockCycle} />)

    // Phase badge should be one of Early/Mid/Late
    const badge = screen.getByText(/(Early|Mid|Late)/)
    expect(badge).toBeInTheDocument()
  })
})

describe('TopBarSkeleton', () => {
  it('renders skeleton elements', () => {
    render(<TopBarSkeleton />)

    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})
