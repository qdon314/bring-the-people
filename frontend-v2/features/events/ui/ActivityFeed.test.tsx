import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActivityFeed } from './ActivityFeed'
import type { EventResponse } from '@/features/events/api'

function makeEvent(overrides: Partial<EventResponse> = {}): EventResponse {
  return {
    event_id: 'evt-1',
    at: new Date(Date.now() - 5 * 60_000).toISOString(), // 5 minutes ago
    show_id: 'show-1',
    cycle_id: 'cycle-1',
    type: 'segment.approved',
    actor: 'human',
    display: { title: 'Segment approved', subtitle: 'Young professionals' },
    payload: {},
    ...overrides,
  }
}

describe('ActivityFeed', () => {
  it('shows "No activity yet" when events is empty', () => {
    render(<ActivityFeed events={[]} />)
    expect(screen.getByText(/No activity yet/i)).toBeInTheDocument()
  })

  it('renders event title and subtitle', () => {
    render(<ActivityFeed events={[makeEvent()]} />)
    expect(screen.getByText('Segment approved')).toBeInTheDocument()
    expect(screen.getByText('Young professionals')).toBeInTheDocument()
  })

  it('renders newest events first', () => {
    const older = makeEvent({
      event_id: 'evt-old',
      at: new Date(Date.now() - 120 * 60_000).toISOString(),
      display: { title: 'Older event', subtitle: '' },
    })
    const newer = makeEvent({
      event_id: 'evt-new',
      at: new Date(Date.now() - 10 * 60_000).toISOString(),
      display: { title: 'Newer event', subtitle: '' },
    })
    render(<ActivityFeed events={[older, newer]} />)
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Newer event')
    expect(items[1]).toHaveTextContent('Older event')
  })

  it('has accessible list label', () => {
    render(<ActivityFeed events={[makeEvent()]} />)
    expect(screen.getByRole('list', { name: /Recent activity/i })).toBeInTheDocument()
  })
})
