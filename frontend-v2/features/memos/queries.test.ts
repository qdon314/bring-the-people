import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { useMemos, useMemo } from './queries'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const mockMemos = [
  {
    memo_id: 'memo-1',
    show_id: 'show-1',
    cycle_id: 'cycle-1',
    cycle_start: '2026-01-01T00:00:00Z',
    cycle_end: '2026-02-01T00:00:00Z',
    markdown: '# Memo 1',
  },
]

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useMemos', () => {
  it('returns memo list for a show', async () => {
    server.use(http.get(`${API_BASE_URL}/api/memos`, () => HttpResponse.json(mockMemos)))
    const { result } = renderHook(() => useMemos('show-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('is disabled when showId is empty', () => {
    const { result } = renderHook(() => useMemos(''), { wrapper: makeWrapper() })
    expect(result.current.isPending).toBe(true)
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('sets isError on server failure', async () => {
    server.use(http.get(`${API_BASE_URL}/api/memos`, () => HttpResponse.json({}, { status: 500 })))
    const { result } = renderHook(() => useMemos('show-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useMemo', () => {
  it('returns single memo by id', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/memos/memo-1`, () => HttpResponse.json(mockMemos[0]))
    )
    const { result } = renderHook(() => useMemo('memo-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.memo_id).toBe('memo-1')
  })

  it('is disabled when memoId is empty', () => {
    const { result } = renderHook(() => useMemo(''), { wrapper: makeWrapper() })
    expect(result.current.isPending).toBe(true)
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('sets isError on 404', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/memos/bad-id`, () => HttpResponse.json({}, { status: 404 }))
    )
    const { result } = renderHook(() => useMemo('bad-id'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
