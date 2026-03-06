const mockUseMemo = vi.fn()

vi.mock('../queries', () => ({
  useMemos: vi.fn(),
  useMemo: (...args: unknown[]) => mockUseMemo(...args),
}))

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoViewer } from './MemoViewer'

const mockMemo = {
  memo_id: 'memo-1',
  show_id: 'show-1',
  cycle_id: 'cycle-1',
  cycle_start: '2026-01-01T00:00:00Z',
  cycle_end: '2026-02-01T00:00:00Z',
  markdown: '# Summary\n\nTest content.',
}

describe('MemoViewer', () => {
  beforeEach(() => {
    mockUseMemo.mockReset()
  })

  it('shows placeholder when no memoId is provided', () => {
    mockUseMemo.mockReturnValue({ isLoading: false, isError: false, data: undefined })
    render(<MemoViewer />)
    expect(screen.getByText(/select a memo to view/i)).toBeInTheDocument()
  })

  it('shows loading skeleton while fetching', () => {
    mockUseMemo.mockReturnValue({ isLoading: true, isError: false, data: undefined })
    render(<MemoViewer memoId="memo-1" />)
    expect(screen.getByLabelText(/loading memo/i)).toBeInTheDocument()
  })

  it('shows error banner on failure', () => {
    mockUseMemo.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      refetch: vi.fn(),
    })
    render(<MemoViewer memoId="memo-1" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/failed to load memo/i)).toBeInTheDocument()
  })

  it('renders memo content when loaded', () => {
    mockUseMemo.mockReturnValue({ isLoading: false, isError: false, data: mockMemo })
    render(<MemoViewer memoId="memo-1" />)
    expect(screen.getByRole('heading', { name: /cycle memo/i })).toBeInTheDocument()
    expect(screen.getByText(/# Summary/)).toBeInTheDocument()
  })
})
