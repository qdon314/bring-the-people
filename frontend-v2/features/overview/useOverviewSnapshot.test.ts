import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { useOverviewSnapshot } from './useOverviewSnapshot'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const SHOW_ID = 'show-1'
const CYCLE_ID = 'cycle-1'

const defaultSegments = [{ segment_id: 'seg-1', show_id: SHOW_ID, cycle_id: CYCLE_ID, review_status: 'approved', name: 'Gen Pop' }]
const defaultFrames = [{ frame_id: 'frame-1', show_id: SHOW_ID, cycle_id: CYCLE_ID, review_status: 'approved', name: 'Frame 1' }]
const defaultVariants = [{ variant_id: 'var-1', frame_id: 'frame-1', review_status: 'approved', agent_output: null, approved_copy: null, edited_by_human: false }]
const defaultExperiments = [{ experiment_id: 'exp-1', show_id: SHOW_ID, cycle_id: CYCLE_ID, status: 'active' }]
const defaultObservations = [{ observation_id: 'obs-1', experiment_id: 'exp-1' }]
const defaultMemos = [{ memo_id: 'memo-1', show_id: SHOW_ID, cycle_id: CYCLE_ID }]
const defaultEvents = [{ event_id: 'evt-1', show_id: SHOW_ID, cycle_id: CYCLE_ID, event_type: 'segment_approved' }]

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

function setupHandlers() {
  server.use(
    http.get(`${API_BASE_URL}/api/segments`, () => HttpResponse.json(defaultSegments)),
    http.get(`${API_BASE_URL}/api/frames`, () => HttpResponse.json(defaultFrames)),
    http.get(`${API_BASE_URL}/api/variants`, () => HttpResponse.json(defaultVariants)),
    http.get(`${API_BASE_URL}/api/experiments`, () => HttpResponse.json(defaultExperiments)),
    http.get(`${API_BASE_URL}/api/observations`, () => HttpResponse.json(defaultObservations)),
    http.get(`${API_BASE_URL}/api/memos`, () => HttpResponse.json(defaultMemos)),
    http.get(`${API_BASE_URL}/api/events`, () => HttpResponse.json(defaultEvents)),
  )
}

describe('useOverviewSnapshot', () => {
  describe('happy path', () => {
    it('starts in loading state', () => {
      setupHandlers()
      const { result } = renderHook(
        () => useOverviewSnapshot({ showId: SHOW_ID, cycleId: CYCLE_ID }),
        { wrapper: makeWrapper() }
      )

      expect(result.current.isLoading).toBe(true)
      expect(result.current.snapshot).toBeUndefined()
      expect(result.current.events).toBeUndefined()
    })

    it('resolves snapshot with aggregated data from all domains', async () => {
      setupHandlers()
      const { result } = renderHook(
        () => useOverviewSnapshot({ showId: SHOW_ID, cycleId: CYCLE_ID }),
        { wrapper: makeWrapper() }
      )

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.isError).toBe(false)
      expect(result.current.snapshot).toBeDefined()
      expect(result.current.snapshot?.segments).toHaveLength(1)
      expect(result.current.snapshot?.frames).toHaveLength(1)
      expect(result.current.snapshot?.variants).toHaveLength(1)
      expect(result.current.snapshot?.experiments).toHaveLength(1)
      expect(result.current.snapshot?.observations).toHaveLength(1)
      expect(result.current.snapshot?.memos).toHaveLength(1)
    })

    it('resolves events separately from snapshot', async () => {
      setupHandlers()
      const { result } = renderHook(
        () => useOverviewSnapshot({ showId: SHOW_ID, cycleId: CYCLE_ID }),
        { wrapper: makeWrapper() }
      )

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.events).toHaveLength(1)
      expect(result.current.events?.[0].event_id).toBe('evt-1')
    })
  })

  describe('cycle-id filtering', () => {
    it('excludes experiments from other cycles', async () => {
      const otherCycleExp = { experiment_id: 'exp-other', show_id: SHOW_ID, cycle_id: 'cycle-99', status: 'active' }
      server.use(
        http.get(`${API_BASE_URL}/api/segments`, () => HttpResponse.json(defaultSegments)),
        http.get(`${API_BASE_URL}/api/frames`, () => HttpResponse.json(defaultFrames)),
        http.get(`${API_BASE_URL}/api/variants`, () => HttpResponse.json(defaultVariants)),
        http.get(`${API_BASE_URL}/api/experiments`, () =>
          HttpResponse.json([...defaultExperiments, otherCycleExp])
        ),
        http.get(`${API_BASE_URL}/api/observations`, () => HttpResponse.json(defaultObservations)),
        http.get(`${API_BASE_URL}/api/memos`, () => HttpResponse.json(defaultMemos)),
        http.get(`${API_BASE_URL}/api/events`, () => HttpResponse.json(defaultEvents)),
      )

      const { result } = renderHook(
        () => useOverviewSnapshot({ showId: SHOW_ID, cycleId: CYCLE_ID }),
        { wrapper: makeWrapper() }
      )
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.snapshot?.experiments).toHaveLength(1)
      expect(result.current.snapshot?.experiments[0].experiment_id).toBe('exp-1')
    })

    it('excludes memos from other cycles', async () => {
      const otherCycleMemo = { memo_id: 'memo-other', show_id: SHOW_ID, cycle_id: 'cycle-99' }
      server.use(
        http.get(`${API_BASE_URL}/api/segments`, () => HttpResponse.json(defaultSegments)),
        http.get(`${API_BASE_URL}/api/frames`, () => HttpResponse.json(defaultFrames)),
        http.get(`${API_BASE_URL}/api/variants`, () => HttpResponse.json(defaultVariants)),
        http.get(`${API_BASE_URL}/api/experiments`, () => HttpResponse.json(defaultExperiments)),
        http.get(`${API_BASE_URL}/api/observations`, () => HttpResponse.json(defaultObservations)),
        http.get(`${API_BASE_URL}/api/memos`, () =>
          HttpResponse.json([...defaultMemos, otherCycleMemo])
        ),
        http.get(`${API_BASE_URL}/api/events`, () => HttpResponse.json(defaultEvents)),
      )

      const { result } = renderHook(
        () => useOverviewSnapshot({ showId: SHOW_ID, cycleId: CYCLE_ID }),
        { wrapper: makeWrapper() }
      )
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.snapshot?.memos).toHaveLength(1)
      expect(result.current.snapshot?.memos[0].memo_id).toBe('memo-1')
    })
  })

  describe('empty cycle', () => {
    it('returns empty snapshot when no resources exist', async () => {
      server.use(
        http.get(`${API_BASE_URL}/api/segments`, () => HttpResponse.json([])),
        http.get(`${API_BASE_URL}/api/frames`, () => HttpResponse.json([])),
        http.get(`${API_BASE_URL}/api/variants`, () => HttpResponse.json([])),
        http.get(`${API_BASE_URL}/api/experiments`, () => HttpResponse.json([])),
        http.get(`${API_BASE_URL}/api/observations`, () => HttpResponse.json([])),
        http.get(`${API_BASE_URL}/api/memos`, () => HttpResponse.json([])),
        http.get(`${API_BASE_URL}/api/events`, () => HttpResponse.json([])),
      )

      const { result } = renderHook(
        () => useOverviewSnapshot({ showId: SHOW_ID, cycleId: CYCLE_ID }),
        { wrapper: makeWrapper() }
      )
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.isError).toBe(false)
      expect(result.current.snapshot).toBeDefined()
      expect(result.current.snapshot?.segments).toHaveLength(0)
      expect(result.current.snapshot?.frames).toHaveLength(0)
      expect(result.current.snapshot?.variants).toHaveLength(0)
    })
  })

  describe('dependent fetches', () => {
    it('fetches variants for each frame returned', async () => {
      const frame2 = { frame_id: 'frame-2', show_id: SHOW_ID, cycle_id: CYCLE_ID, review_status: 'pending', name: 'Frame 2' }
      const variantsFrame2 = [{ variant_id: 'var-2', frame_id: 'frame-2', review_status: 'pending', agent_output: null, approved_copy: null, edited_by_human: false }]

      server.use(
        http.get(`${API_BASE_URL}/api/segments`, () => HttpResponse.json(defaultSegments)),
        http.get(`${API_BASE_URL}/api/frames`, () => HttpResponse.json([...defaultFrames, frame2])),
        http.get(`${API_BASE_URL}/api/variants`, ({ request }) => {
          const frameId = new URL(request.url).searchParams.get('frame_id')
          if (frameId === 'frame-1') return HttpResponse.json(defaultVariants)
          if (frameId === 'frame-2') return HttpResponse.json(variantsFrame2)
          return HttpResponse.json([])
        }),
        http.get(`${API_BASE_URL}/api/experiments`, () => HttpResponse.json(defaultExperiments)),
        http.get(`${API_BASE_URL}/api/observations`, () => HttpResponse.json(defaultObservations)),
        http.get(`${API_BASE_URL}/api/memos`, () => HttpResponse.json(defaultMemos)),
        http.get(`${API_BASE_URL}/api/events`, () => HttpResponse.json(defaultEvents)),
      )

      const { result } = renderHook(
        () => useOverviewSnapshot({ showId: SHOW_ID, cycleId: CYCLE_ID }),
        { wrapper: makeWrapper() }
      )
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.snapshot?.variants).toHaveLength(2)
    })
  })

  describe('error state', () => {
    it('sets isError and error when a phase 1 fetch fails', async () => {
      server.use(
        http.get(`${API_BASE_URL}/api/segments`, () =>
          HttpResponse.json({ detail: 'Server error' }, { status: 500 })
        ),
        http.get(`${API_BASE_URL}/api/frames`, () => HttpResponse.json(defaultFrames)),
        http.get(`${API_BASE_URL}/api/variants`, () => HttpResponse.json(defaultVariants)),
        http.get(`${API_BASE_URL}/api/experiments`, () => HttpResponse.json(defaultExperiments)),
        http.get(`${API_BASE_URL}/api/observations`, () => HttpResponse.json(defaultObservations)),
        http.get(`${API_BASE_URL}/api/memos`, () => HttpResponse.json(defaultMemos)),
        http.get(`${API_BASE_URL}/api/events`, () => HttpResponse.json(defaultEvents)),
      )

      const { result } = renderHook(
        () => useOverviewSnapshot({ showId: SHOW_ID, cycleId: CYCLE_ID }),
        { wrapper: makeWrapper() }
      )
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.isError).toBe(true)
      expect(result.current.error).toBeInstanceOf(Error)
      expect(result.current.snapshot).toBeUndefined()
    })

    it('sets isError when a variant fetch fails', async () => {
      server.use(
        http.get(`${API_BASE_URL}/api/segments`, () => HttpResponse.json(defaultSegments)),
        http.get(`${API_BASE_URL}/api/frames`, () => HttpResponse.json(defaultFrames)),
        http.get(`${API_BASE_URL}/api/variants`, () =>
          HttpResponse.json({ detail: 'Server error' }, { status: 500 })
        ),
        http.get(`${API_BASE_URL}/api/experiments`, () => HttpResponse.json(defaultExperiments)),
        http.get(`${API_BASE_URL}/api/observations`, () => HttpResponse.json(defaultObservations)),
        http.get(`${API_BASE_URL}/api/memos`, () => HttpResponse.json(defaultMemos)),
        http.get(`${API_BASE_URL}/api/events`, () => HttpResponse.json(defaultEvents)),
      )

      const { result } = renderHook(
        () => useOverviewSnapshot({ showId: SHOW_ID, cycleId: CYCLE_ID }),
        { wrapper: makeWrapper() }
      )
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.isError).toBe(true)
      expect(result.current.snapshot).toBeUndefined()
    })
  })
})
