import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { useVariants } from './queries'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const mockVariants = [{ variant_id: 'var-1', frame_id: 'frame-1', review_status: 'pending', agent_output: null, approved_copy: null, edited_by_human: false }]

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useVariants', () => {
  it('returns variant list for a frame', async () => {
    server.use(http.get(`${API_BASE_URL}/api/variants`, () => HttpResponse.json(mockVariants)))
    const { result } = renderHook(() => useVariants('frame-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('is disabled when frameId is empty', () => {
    const { result } = renderHook(() => useVariants(''), { wrapper: makeWrapper() })
    expect(result.current.isPending).toBe(true)
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('sets isError on server failure', async () => {
    server.use(http.get(`${API_BASE_URL}/api/variants`, () => HttpResponse.json({}, { status: 500 })))
    const { result } = renderHook(() => useVariants('frame-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
