import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoView } from './MemoView'
import type { MemoResponse } from '../api'

const baseMemo: MemoResponse = {
  memo_id: 'memo-1',
  show_id: 'show-1',
  cycle_id: 'cycle-1',
  cycle_start: '2026-03-01T12:00:00Z',
  cycle_end: '2026-03-31T12:00:00Z',
  markdown: '# Summary\n\nThis cycle performed well.',
}

describe('MemoView', () => {
  it('renders memo markdown content', () => {
    render(<MemoView memo={baseMemo} />)
    expect(screen.getByText(/# Summary/)).toBeInTheDocument()
    expect(screen.getByText(/this cycle performed well/i)).toBeInTheDocument()
  })

  it('renders date range in header', () => {
    render(<MemoView memo={baseMemo} />)
    // Check that the date range paragraph is present (exact output is locale/tz-dependent)
    const header = screen.getByRole('heading', { name: /cycle memo/i })
    const datePara = header.nextElementSibling
    expect(datePara).toBeTruthy()
    expect(datePara?.textContent).toMatch(/2026/)
  })

  it('shows "No content" for empty markdown', () => {
    render(<MemoView memo={{ ...baseMemo, markdown: '' }} />)
    expect(screen.getByText(/no content/i)).toBeInTheDocument()
  })

  it('renders heading', () => {
    render(<MemoView memo={baseMemo} />)
    expect(screen.getByRole('heading', { name: /cycle memo/i })).toBeInTheDocument()
  })
})
