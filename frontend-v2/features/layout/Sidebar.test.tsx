import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Sidebar } from './Sidebar'
import { NextRouter } from 'next/router'

// Use the AppRouterContext for Next.js 13+ app router
async function MockRouter() {
  return {
    pathname: '/',
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    reload: vi.fn(),
    isFallback: false,
    isLocaleDomain: false,
    isPreview: false,
    isReady: true,
    basePath: '',
    locale: 'en',
    domainLocales: [],
    defaultLocale: 'en',
    route: '/',
    query: {},
    asPath: '/',
    beforePopState: vi.fn(),
    events: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
  }
}

// Simple test without router context - we can test the hrefs directly
describe('Sidebar', () => {
  const defaultProps = {
    showId: 'show-123',
    cycleId: 'cycle-456',
  }

  it('renders all navigation items', () => {
    render(<Sidebar {...defaultProps} />)

    // Check all nav items are rendered
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Plan')).toBeInTheDocument()
    expect(screen.getByText('Create')).toBeInTheDocument()
    expect(screen.getByText('Run')).toBeInTheDocument()
    expect(screen.getByText('Results')).toBeInTheDocument()
    expect(screen.getByText('Memo')).toBeInTheDocument()
  })

  it('renders navigation links with correct hrefs', () => {
    render(<Sidebar {...defaultProps} />)

    // Check that links have correct hrefs
    const overviewLink = screen.getByRole('link', { name: /overview/i })
    expect(overviewLink).toHaveAttribute('href', '/shows/show-123/cycles/cycle-456/overview')

    const planLink = screen.getByRole('link', { name: /plan/i })
    expect(planLink).toHaveAttribute('href', '/shows/show-123/cycles/cycle-456/plan')

    const createLink = screen.getByRole('link', { name: /create/i })
    expect(createLink).toHaveAttribute('href', '/shows/show-123/cycles/cycle-456/create')

    const runLink = screen.getByRole('link', { name: /run/i })
    expect(runLink).toHaveAttribute('href', '/shows/show-123/cycles/cycle-456/run')

    const resultsLink = screen.getByRole('link', { name: /results/i })
    expect(resultsLink).toHaveAttribute('href', '/shows/show-123/cycles/cycle-456/results')

    const memoLink = screen.getByRole('link', { name: /memo/i })
    expect(memoLink).toHaveAttribute('href', '/shows/show-123/cycles/cycle-456/memo')
  })

  it('renders as nav element', () => {
    render(<Sidebar {...defaultProps} />)

    const nav = screen.getByRole('navigation')
    expect(nav).toBeInTheDocument()
  })

  it('contains links for all tab pages', () => {
    render(<Sidebar {...defaultProps} />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(6) // 6 navigation items
  })

  it('has proper accessibility attributes for navigation', () => {
    render(<Sidebar {...defaultProps} />)

    const nav = screen.getByRole('navigation')
    expect(nav).toBeInTheDocument()
    
    // All links should be accessible
    const links = screen.getAllByRole('link')
    links.forEach(link => {
      expect(link).toBeVisible()
    })
  })
})
