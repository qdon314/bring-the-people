import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { useJob } from './queries'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const mockJob = {
  job_id: 'job-1',
  job_type: 'strategy',
  status: 'completed',
  show_id: 'show-1',
  result_json: null,
  error_message: null,
  attempt_count: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:01:00Z',
  completed_at: '2026-01-01T00:01:00Z',
}

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useJob', () => {
  it('returns a job by id', async () => {
    server.use(http.get(`${API_BASE_URL}/api/jobs/:jobId`, () => HttpResponse.json(mockJob)))
    const { result } = renderHook(() => useJob('job-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.job_id).toBe('job-1')
  })

  it('is disabled when jobId is null', () => {
    const { result } = renderHook(() => useJob(null), { wrapper: makeWrapper() })
    expect(result.current.isPending).toBe(true)
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('sets isError on server failure', async () => {
    server.use(http.get(`${API_BASE_URL}/api/jobs/:jobId`, () => HttpResponse.json({}, { status: 500 })))
    const { result } = renderHook(() => useJob('job-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
