import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { useShows, useShow } from './queries'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useShows', () => {
  it('returns show list on success', async () => {
    const { result } = renderHook(() => useShows(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(Array.isArray(result.current.data)).toBe(true)
  })

  it('sets isError on server failure', async () => {
    server.use(http.get(`${API_BASE_URL}/api/shows`, () => HttpResponse.json({}, { status: 500 })))
    const { result } = renderHook(() => useShows(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useShow', () => {
  it('returns a single show by id', async () => {
    const { result } = renderHook(() => useShow('show-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.show_id).toBe('show-1')
  })

  it('is disabled when showId is empty', () => {
    const { result } = renderHook(() => useShow(''), { wrapper: makeWrapper() })
    expect(result.current.isPending).toBe(true)
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('sets isError on 404', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/shows/:id`, () =>
        HttpResponse.json({ detail: 'Not found' }, { status: 404 })
      )
    )
    const { result } = renderHook(() => useShow('missing'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
