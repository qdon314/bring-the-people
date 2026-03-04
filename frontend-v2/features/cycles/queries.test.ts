import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { useCycles, useCycle } from './queries'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useCycles', () => {
  it('returns cycle list for a show', async () => {
    const { result } = renderHook(() => useCycles('show-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(Array.isArray(result.current.data)).toBe(true)
    expect(result.current.data?.length).toBeGreaterThan(0)
  })

  it('is disabled when showId is empty', () => {
    const { result } = renderHook(() => useCycles(''), { wrapper: makeWrapper() })
    expect(result.current.isPending).toBe(true)
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('sets isError on server failure', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/shows/:showId/cycles`, () =>
        HttpResponse.json({}, { status: 500 })
      )
    )
    const { result } = renderHook(() => useCycles('show-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useCycle', () => {
  it('returns a single cycle by id', async () => {
    const { result } = renderHook(() => useCycle('cycle-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.cycle_id).toBe('cycle-1')
  })

  it('is disabled when cycleId is empty', () => {
    const { result } = renderHook(() => useCycle(''), { wrapper: makeWrapper() })
    expect(result.current.isPending).toBe(true)
    expect(result.current.fetchStatus).toBe('idle')
  })
})
