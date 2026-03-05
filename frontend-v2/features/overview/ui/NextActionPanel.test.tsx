import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextActionPanel, NextActionPanelSkeleton } from './NextActionPanel'
import type { CycleProgress } from '@/features/cycles/getCycleProgress'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

const SHOW_ID = 'show-1'
const CYCLE_ID = 'cycle-1'

function makeProgress(nextAction: CycleProgress['nextAction']): CycleProgress {
  return {
    planComplete: false,
    createComplete: false,
    runComplete: false,
    resultsComplete: false,
    memoComplete: false,
    nextAction,
  }
}

describe('NextActionPanel', () => {
  it('links to plan tab when nextAction is plan', () => {
    render(<NextActionPanel progress={makeProgress('plan')} showId={SHOW_ID} cycleId={CYCLE_ID} />)
    const link = screen.getByRole('link', { name: /Go to Plan/i })
    expect(link).toHaveAttribute('href', `/shows/${SHOW_ID}/cycles/${CYCLE_ID}/plan`)
  })

  it('links to create tab when nextAction is create', () => {
    render(<NextActionPanel progress={makeProgress('create')} showId={SHOW_ID} cycleId={CYCLE_ID} />)
    const link = screen.getByRole('link', { name: /Go to Create/i })
    expect(link).toHaveAttribute('href', `/shows/${SHOW_ID}/cycles/${CYCLE_ID}/create`)
  })

  it('links to run tab when nextAction is run', () => {
    render(<NextActionPanel progress={makeProgress('run')} showId={SHOW_ID} cycleId={CYCLE_ID} />)
    expect(screen.getByRole('link', { name: /Go to Run/i })).toHaveAttribute(
      'href',
      `/shows/${SHOW_ID}/cycles/${CYCLE_ID}/run`
    )
  })

  it('links to results tab when nextAction is results', () => {
    render(<NextActionPanel progress={makeProgress('results')} showId={SHOW_ID} cycleId={CYCLE_ID} />)
    expect(screen.getByRole('link', { name: /Go to Results/i })).toHaveAttribute(
      'href',
      `/shows/${SHOW_ID}/cycles/${CYCLE_ID}/results`
    )
  })

  it('links to memo tab when nextAction is memo', () => {
    render(<NextActionPanel progress={makeProgress('memo')} showId={SHOW_ID} cycleId={CYCLE_ID} />)
    expect(screen.getByRole('link', { name: /Go to Memo/i })).toHaveAttribute(
      'href',
      `/shows/${SHOW_ID}/cycles/${CYCLE_ID}/memo`
    )
  })

  it('shows completion message when nextAction is complete', () => {
    render(<NextActionPanel progress={makeProgress('complete')} showId={SHOW_ID} cycleId={CYCLE_ID} />)
    expect(screen.getByText(/Cycle complete/i)).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})

describe('NextActionPanelSkeleton', () => {
  it('renders and is aria-hidden', () => {
    const { container } = render(<NextActionPanelSkeleton />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })
})
