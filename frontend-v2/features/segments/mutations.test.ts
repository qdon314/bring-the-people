import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { useApproveSegment, useRejectSegment, useUpdateSegment } from './mutations'
import { queryKeys } from '@/shared/queryKeys'
import type { SegmentResponse } from './api'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const SHOW_ID = 'show-1'
const SEGMENT_ID = 'seg-1'

const mockSegment: SegmentResponse = {
  segment_id: SEGMENT_ID,
  show_id: SHOW_ID,
  cycle_id: 'cycle-1',
  name: 'Gen Pop',
  definition_json: { age_range: '18-35' },
  estimated_size: 5000,
  created_by: 'agent',
  review_status: 'pending',
  reviewed_at: null,
  reviewed_by: null,
}

const approvedSegment: SegmentResponse = {
  ...mockSegment,
  review_status: 'approved',
  reviewed_by: 'producer',
  reviewed_at: '2026-03-05T12:00:00Z',
}

const rejectedSegment: SegmentResponse = {
  ...mockSegment,
  review_status: 'rejected',
  reviewed_by: 'producer',
  reviewed_at: '2026-03-05T12:00:00Z',
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
    queryClient,
  }
}

describe('useApproveSegment', () => {
  it('calls POST /api/segments/{segment_id}/review with action: approve', async () => {
    let capturedBody: unknown = null

    server.use(
      http.post(`${API_BASE_URL}/api/segments/${SEGMENT_ID}/review`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(approvedSegment)
      })
    )

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useApproveSegment(SHOW_ID), { wrapper })

    act(() => {
      result.current.mutate({ segmentId: SEGMENT_ID })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(capturedBody).toMatchObject({ action: 'approve', reviewed_by: 'producer' })
  })

  it('applies optimistic update and reverts on error', async () => {
    server.use(
      http.post(`${API_BASE_URL}/api/segments/${SEGMENT_ID}/review`, () =>
        HttpResponse.json({ detail: 'Server error' }, { status: 500 })
      )
    )

    const { wrapper, queryClient } = makeWrapper()
    const listKey = queryKeys.segments.list(SHOW_ID)

    // Pre-populate the cache with pending segment
    queryClient.setQueryData(listKey, [mockSegment])

    const { result } = renderHook(() => useApproveSegment(SHOW_ID), { wrapper })

    act(() => {
      result.current.mutate({ segmentId: SEGMENT_ID })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    // Cache should have reverted to pending
    const cachedData = queryClient.getQueryData<SegmentResponse[]>(listKey)
    expect(cachedData?.[0].review_status).toBe('pending')
  })

  it('invalidates segment queries on success', async () => {
    server.use(
      http.post(`${API_BASE_URL}/api/segments/${SEGMENT_ID}/review`, () =>
        HttpResponse.json(approvedSegment)
      )
    )

    const { wrapper, queryClient } = makeWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useApproveSegment(SHOW_ID), { wrapper })

    act(() => {
      result.current.mutate({ segmentId: SEGMENT_ID })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.segments.list(SHOW_ID) })
    )
  })
})

describe('useRejectSegment', () => {
  it('calls POST /api/segments/{segment_id}/review with action: reject', async () => {
    let capturedBody: unknown = null

    server.use(
      http.post(`${API_BASE_URL}/api/segments/${SEGMENT_ID}/review`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(rejectedSegment)
      })
    )

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useRejectSegment(SHOW_ID), { wrapper })

    act(() => {
      result.current.mutate({ segmentId: SEGMENT_ID, notes: 'Too broad' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(capturedBody).toMatchObject({ action: 'reject', reviewed_by: 'producer', notes: 'Too broad' })
  })

  it('applies optimistic update to rejected and reverts on error', async () => {
    server.use(
      http.post(`${API_BASE_URL}/api/segments/${SEGMENT_ID}/review`, () =>
        HttpResponse.json({ detail: 'Server error' }, { status: 500 })
      )
    )

    const { wrapper, queryClient } = makeWrapper()
    const listKey = queryKeys.segments.list(SHOW_ID)

    queryClient.setQueryData(listKey, [mockSegment])

    const { result } = renderHook(() => useRejectSegment(SHOW_ID), { wrapper })

    act(() => {
      result.current.mutate({ segmentId: SEGMENT_ID })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    const cachedData = queryClient.getQueryData<SegmentResponse[]>(listKey)
    expect(cachedData?.[0].review_status).toBe('pending')
  })

  it('invalidates segment queries on success', async () => {
    server.use(
      http.post(`${API_BASE_URL}/api/segments/${SEGMENT_ID}/review`, () =>
        HttpResponse.json(rejectedSegment)
      )
    )

    const { wrapper, queryClient } = makeWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useRejectSegment(SHOW_ID), { wrapper })

    act(() => {
      result.current.mutate({ segmentId: SEGMENT_ID })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.segments.list(SHOW_ID) })
    )
  })
})

describe('useUpdateSegment', () => {
  const updatedSegment: SegmentResponse = {
    ...mockSegment,
    name: 'Updated Name',
    estimated_size: 9000,
  }

  it('calls PATCH /api/segments/{segment_id} with updated fields', async () => {
    let capturedBody: unknown = null

    server.use(
      http.patch(`${API_BASE_URL}/api/segments/${SEGMENT_ID}`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(updatedSegment)
      })
    )

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useUpdateSegment(SHOW_ID), { wrapper })

    act(() => {
      result.current.mutate({ segmentId: SEGMENT_ID, name: 'Updated Name', estimatedSize: 9000 })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(capturedBody).toMatchObject({ name: 'Updated Name', estimated_size: 9000 })
  })

  it('omits undefined fields from the PATCH body', async () => {
    let capturedBody: unknown = null

    server.use(
      http.patch(`${API_BASE_URL}/api/segments/${SEGMENT_ID}`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(updatedSegment)
      })
    )

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useUpdateSegment(SHOW_ID), { wrapper })

    act(() => {
      result.current.mutate({ segmentId: SEGMENT_ID, name: 'Only Name' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(capturedBody).toMatchObject({ name: 'Only Name' })
    expect(capturedBody).not.toHaveProperty('estimated_size')
  })

  it('invalidates segment list on success', async () => {
    server.use(
      http.patch(`${API_BASE_URL}/api/segments/${SEGMENT_ID}`, () =>
        HttpResponse.json(updatedSegment)
      )
    )

    const { wrapper, queryClient } = makeWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateSegment(SHOW_ID), { wrapper })

    act(() => {
      result.current.mutate({ segmentId: SEGMENT_ID, name: 'Updated Name' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.segments.list(SHOW_ID) })
    )
  })

  it('surfaces error on 422', async () => {
    server.use(
      http.patch(`${API_BASE_URL}/api/segments/${SEGMENT_ID}`, () =>
        HttpResponse.json({ detail: 'Validation error' }, { status: 422 })
      )
    )

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useUpdateSegment(SHOW_ID), { wrapper })

    act(() => {
      result.current.mutate({ segmentId: SEGMENT_ID, name: 'x'.repeat(300) })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
