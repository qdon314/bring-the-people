import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { useExperiments } from './queries'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const mockExperiments = [{ experiment_id: 'exp-1', show_id: 'show-1', cycle_id: 'cycle-1', status: 'draft' }]

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useExperiments', () => {
  it('returns experiment list for a show', async () => {
    server.use(http.get(`${API_BASE_URL}/api/experiments`, () => HttpResponse.json(mockExperiments)))
    const { result } = renderHook(() => useExperiments('show-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('is disabled when showId is empty', () => {
    const { result } = renderHook(() => useExperiments(''), { wrapper: makeWrapper() })
    expect(result.current.isPending).toBe(true)
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('sets isError on server failure', async () => {
    server.use(http.get(`${API_BASE_URL}/api/experiments`, () => HttpResponse.json({}, { status: 500 })))
    const { result } = renderHook(() => useExperiments('show-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
