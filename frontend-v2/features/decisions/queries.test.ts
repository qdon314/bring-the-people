import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { useDecisions } from './queries'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const mockDecisions = [
  {
    decision_id: 'dec-1',
    run_id: 'run-1',
    action: 'scale_up',
    confidence: 0.85,
    rationale: 'Strong positive signal',
    policy_version: 'v1',
    metrics_snapshot: {},
  },
]

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useDecisions', () => {
  it('returns decision list for a run', async () => {
    server.use(http.get(`${API_BASE_URL}/api/decisions`, () => HttpResponse.json(mockDecisions)))
    const { result } = renderHook(() => useDecisions('run-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('is disabled when runId is empty', () => {
    const { result } = renderHook(() => useDecisions(''), { wrapper: makeWrapper() })
    expect(result.current.isPending).toBe(true)
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('sets isError on server failure', async () => {
    server.use(http.get(`${API_BASE_URL}/api/decisions`, () => HttpResponse.json({}, { status: 500 })))
    const { result } = renderHook(() => useDecisions('run-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
