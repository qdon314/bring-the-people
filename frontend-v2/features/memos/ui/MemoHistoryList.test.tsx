const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/shows/show-1/cycles/cycle-1/memo',
  useSearchParams: () => mockSearchParams,
}))

const mockUseMemos = vi.fn()

vi.mock('../queries', () => ({
  useMemos: (...args: unknown[]) => mockUseMemos(...args),
  useMemo: vi.fn(),
}))

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoHistoryList } from './MemoHistoryList'

const SHOW_ID = 'show-1'

const mockMemos = [
  {
    memo_id: 'memo-1',
    show_id: SHOW_ID,
    cycle_id: 'cycle-1',
    cycle_start: '2026-01-01T00:00:00Z',
    cycle_end: '2026-02-01T00:00:00Z',
    markdown: '# Memo 1',
  },
  {
    memo_id: 'memo-2',
    show_id: SHOW_ID,
    cycle_id: 'cycle-2',
    cycle_start: '2025-12-01T00:00:00Z',
    cycle_end: '2026-01-01T00:00:00Z',
    markdown: '# Memo 2',
  },
]

describe('MemoHistoryList', () => {
  beforeEach(() => {
    mockPush.mockReset()
    mockUseMemos.mockReset()
  })

  it('shows loading skeleton while fetching', () => {
    mockUseMemos.mockReturnValue({ isLoading: true, isError: false, data: undefined })
    render(<MemoHistoryList showId={SHOW_ID} />)
    expect(screen.getByLabelText(/loading memos/i)).toBeInTheDocument()
  })

  it('shows error banner on failure', () => {
    mockUseMemos.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      refetch: vi.fn(),
    })
    render(<MemoHistoryList showId={SHOW_ID} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/failed to load memo history/i)).toBeInTheDocument()
  })

  it('shows empty state when no memos', () => {
    mockUseMemos.mockReturnValue({ isLoading: false, isError: false, data: [] })
    render(<MemoHistoryList showId={SHOW_ID} />)
    expect(screen.getByText(/no memos yet/i)).toBeInTheDocument()
  })

  it('renders memo list sorted newest first', () => {
    mockUseMemos.mockReturnValue({ isLoading: false, isError: false, data: mockMemos })
    render(<MemoHistoryList showId={SHOW_ID} />)
    const items = screen.getAllByRole('button')
    // memo-1 (Jan 2026) should appear before memo-2 (Dec 2025)
    expect(items[0].textContent).toContain('Jan')
    expect(items[1].textContent).toContain('Dec')
  })

  it('highlights selected memo', () => {
    mockUseMemos.mockReturnValue({ isLoading: false, isError: false, data: mockMemos })
    render(<MemoHistoryList showId={SHOW_ID} selectedMemoId="memo-1" />)
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toHaveClass('border-blue-500')
    expect(buttons[1]).not.toHaveClass('border-blue-500')
  })

  it('calls router.push with memo param on selection', () => {
    mockUseMemos.mockReturnValue({ isLoading: false, isError: false, data: mockMemos })
    render(<MemoHistoryList showId={SHOW_ID} />)
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('memo=memo-1')
    )
  })
})
