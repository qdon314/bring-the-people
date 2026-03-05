import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CycleStepper, CycleStepperSkeleton } from './CycleStepper'
import type { CycleProgress } from '@/features/cycles/getCycleProgress'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import { usePathname } from 'next/navigation'

const mockUsePathname = vi.mocked(usePathname)

const SHOW_ID = 'show-1'
const CYCLE_ID = 'cycle-1'

const noProgress: null = null

const allIncompleteProgress: CycleProgress = {
  planComplete: false,
  createComplete: false,
  runComplete: false,
  resultsComplete: false,
  memoComplete: false,
  nextAction: 'plan',
}

const planDoneProgress: CycleProgress = {
  planComplete: true,
  createComplete: false,
  runComplete: false,
  resultsComplete: false,
  memoComplete: false,
  nextAction: 'create',
}

const allDoneProgress: CycleProgress = {
  planComplete: true,
  createComplete: true,
  runComplete: true,
  resultsComplete: true,
  memoComplete: true,
  nextAction: 'complete',
}

function renderStepper(progress: CycleProgress | null, pathname = `/shows/${SHOW_ID}/cycles/${CYCLE_ID}/overview`) {
  mockUsePathname.mockReturnValue(pathname)
  return render(
    <CycleStepper showId={SHOW_ID} cycleId={CYCLE_ID} progress={progress} />
  )
}

describe('CycleStepper', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue(`/shows/${SHOW_ID}/cycles/${CYCLE_ID}/overview`)
  })

  it('renders all 5 step labels', () => {
    renderStepper(noProgress)
    expect(screen.getByText('Plan')).toBeInTheDocument()
    expect(screen.getByText('Create')).toBeInTheDocument()
    expect(screen.getByText('Run')).toBeInTheDocument()
    expect(screen.getByText('Results')).toBeInTheDocument()
    expect(screen.getByText('Memo')).toBeInTheDocument()
  })

  it('renders each step as a link to the correct route', () => {
    renderStepper(noProgress)
    expect(screen.getByRole('link', { name: /Plan/ })).toHaveAttribute(
      'href',
      `/shows/${SHOW_ID}/cycles/${CYCLE_ID}/plan`
    )
    expect(screen.getByRole('link', { name: /Memo/ })).toHaveAttribute(
      'href',
      `/shows/${SHOW_ID}/cycles/${CYCLE_ID}/memo`
    )
  })

  it('sets aria-current="step" on the active tab', () => {
    renderStepper(noProgress, `/shows/${SHOW_ID}/cycles/${CYCLE_ID}/plan`)
    const planLink = screen.getByRole('link', { name: /Plan/ })
    expect(planLink).toHaveAttribute('aria-current', 'step')
  })

  it('does not set aria-current on inactive tabs', () => {
    renderStepper(noProgress, `/shows/${SHOW_ID}/cycles/${CYCLE_ID}/plan`)
    expect(screen.getByRole('link', { name: /Create/ })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: /Run/ })).not.toHaveAttribute('aria-current')
  })

  it('shows no completion indicators when progress is null', () => {
    renderStepper(noProgress)
    expect(screen.queryByLabelText('complete')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('next action')).not.toBeInTheDocument()
  })

  it('shows a check icon for complete steps', () => {
    renderStepper(planDoneProgress)
    expect(screen.getByLabelText('complete')).toBeInTheDocument()
  })

  it('shows next-action indicator on the recommended next step', () => {
    renderStepper(planDoneProgress, `/shows/${SHOW_ID}/cycles/${CYCLE_ID}/plan`)
    // Plan is done, nextAction is 'create'
    expect(screen.getByLabelText('next action')).toBeInTheDocument()
  })

  it('does not show next-action indicator when active tab matches nextAction', () => {
    // Active on create, nextAction is create — active style takes precedence
    renderStepper(planDoneProgress, `/shows/${SHOW_ID}/cycles/${CYCLE_ID}/create`)
    expect(screen.queryByLabelText('next action')).not.toBeInTheDocument()
  })

  it('shows no next-action indicator when nextAction is "complete"', () => {
    renderStepper(allDoneProgress)
    expect(screen.queryByLabelText('next action')).not.toBeInTheDocument()
  })

  it('shows check icons for all complete steps when all done', () => {
    renderStepper(allDoneProgress)
    const checks = screen.getAllByLabelText('complete')
    expect(checks).toHaveLength(5)
  })

  it('has accessible nav label', () => {
    renderStepper(noProgress)
    expect(screen.getByRole('navigation', { name: /cycle workflow progress/i })).toBeInTheDocument()
  })
})

describe('CycleStepperSkeleton', () => {
  it('renders skeleton elements', () => {
    render(<CycleStepperSkeleton />)
    const pulses = document.querySelectorAll('.animate-pulse')
    expect(pulses.length).toBe(5)
  })

  it('is aria-hidden', () => {
    const { container } = render(<CycleStepperSkeleton />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })
})
