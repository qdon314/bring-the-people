import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { useRunsByCycle, useRun } from './queries'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const mockRun = {
  run_id: 'run-1',
  experiment_id: 'exp-1',
  cycle_id: 'cycle-1',
  status: 'draft',
  start_time: null,
  end_time: null,
  budget_cap_cents_override: null,
  channel_config: {},
  variant_snapshot: {},
}

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useRunsByCycle', () => {
  it('returns runs for a cycle', async () => {
    server.use(http.get(`${API_BASE_URL}/api/runs`, () => HttpResponse.json([mockRun])))
    const { result } = renderHook(() => useRunsByCycle('cycle-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].run_id).toBe('run-1')
  })

  it('is disabled when cycleId is empty', () => {
    const { result } = renderHook(() => useRunsByCycle(''), { wrapper: makeWrapper() })
    expect(result.current.isPending).toBe(true)
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('sets isError on server failure', async () => {
    server.use(http.get(`${API_BASE_URL}/api/runs`, () => HttpResponse.json({}, { status: 500 })))
    const { result } = renderHook(() => useRunsByCycle('cycle-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useRun', () => {
  it('fetches a single run by id', async () => {
    server.use(http.get(`${API_BASE_URL}/api/runs/run-1`, () => HttpResponse.json(mockRun)))
    const { result } = renderHook(() => useRun('run-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.run_id).toBe('run-1')
  })

  it('is disabled when runId is empty', () => {
    const { result } = renderHook(() => useRun(''), { wrapper: makeWrapper() })
    expect(result.current.isPending).toBe(true)
    expect(result.current.fetchStatus).toBe('idle')
  })
})
