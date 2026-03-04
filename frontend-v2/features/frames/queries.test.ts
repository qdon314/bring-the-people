import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { useFrames } from './queries'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const mockFrames = [{ frame_id: 'frame-1', show_id: 'show-1', cycle_id: 'cycle-1', review_status: 'pending', name: 'Frame 1' }]

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useFrames', () => {
  it('returns frame list', async () => {
    server.use(http.get(`${API_BASE_URL}/api/frames`, () => HttpResponse.json(mockFrames)))
    const { result } = renderHook(() => useFrames('show-1', 'cycle-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('is disabled when showId is empty', () => {
    const { result } = renderHook(() => useFrames(''), { wrapper: makeWrapper() })
    expect(result.current.isPending).toBe(true)
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('sets isError on server failure', async () => {
    server.use(http.get(`${API_BASE_URL}/api/frames`, () => HttpResponse.json({}, { status: 500 })))
    const { result } = renderHook(() => useFrames('show-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
