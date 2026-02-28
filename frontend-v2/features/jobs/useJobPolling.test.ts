import { renderHook, waitFor } from '@testing-library/react'
import { getJob } from './api'
import {
  getJobInvalidationKeys,
  getJobPollingIntervalMs,
  isTerminalJobStatus,
  useJobPolling,
} from './useJobPolling'

vi.mock('./api', () => ({
  getJob: vi.fn(),
}))

const runningJob = {
  job_id: 'job-1',
  job_type: 'strategy',
  status: 'running',
  show_id: 'show-1',
  result_json: null,
  error_message: null,
  attempt_count: 1,
  created_at: '2026-02-27T12:00:00Z',
  updated_at: '2026-02-27T12:00:01Z',
  completed_at: null,
}

const completedJob = {
  ...runningJob,
  status: 'completed',
  result_json: { segment_count: 3 },
  completed_at: '2026-02-27T12:00:05Z',
}

const failedJob = {
  ...runningJob,
  status: 'failed',
  error_message: 'boom',
  completed_at: '2026-02-27T12:00:05Z',
}

describe('polling utilities', () => {
  it('calculates the configured interval bands', () => {
    expect(getJobPollingIntervalMs(0)).toBe(1000)
    expect(getJobPollingIntervalMs(5000)).toBe(1000)
    expect(getJobPollingIntervalMs(5001)).toBe(2000)
    expect(getJobPollingIntervalMs(30000)).toBe(2000)
    expect(getJobPollingIntervalMs(30001)).toBe(5000)
  })

  it('detects terminal statuses', () => {
    expect(isTerminalJobStatus('completed')).toBe(true)
    expect(isTerminalJobStatus('failed')).toBe(true)
    expect(isTerminalJobStatus('running')).toBe(false)
  })

  it('maps invalidation keys by job type', () => {
    expect(getJobInvalidationKeys('strategy')).toEqual([
      ['cycles'],
      ['segments'],
      ['frames'],
      ['events'],
    ])

    expect(getJobInvalidationKeys('creative')).toEqual([
      ['variants'],
      ['frames'],
      ['events'],
    ])

    expect(getJobInvalidationKeys('memo')).toEqual([['memos'], ['events']])
    expect(getJobInvalidationKeys('unknown')).toEqual([])
  })
})

describe('useJobPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stops polling and calls onComplete for completed jobs', async () => {
    vi.mocked(getJob).mockResolvedValue(completedJob)

    const onComplete = vi.fn()
    const { result } = renderHook(() => useJobPolling('job-1', { onComplete }))

    await waitFor(() => {
      expect(result.current.isCompleted).toBe(true)
    })

    expect(onComplete).toHaveBeenCalledWith(completedJob, [
      ['cycles'],
      ['segments'],
      ['frames'],
      ['events'],
    ])
    expect(result.current.isPolling).toBe(false)
    expect(result.current.attemptCount).toBe(1)
  })

  it('stops polling and calls onFailed for failed jobs', async () => {
    vi.mocked(getJob).mockResolvedValue(failedJob)

    const onFailed = vi.fn()
    const { result } = renderHook(() => useJobPolling('job-1', { onFailed }))

    await waitFor(() => {
      expect(result.current.isFailed).toBe(true)
    })

    expect(onFailed).toHaveBeenCalledWith(failedJob)
    expect(result.current.isPolling).toBe(false)
  })

  it('stops polling and exposes errors when request fails', async () => {
    const networkError = new Error('Network error')
    vi.mocked(getJob).mockRejectedValue(networkError)

    const onError = vi.fn()
    const { result } = renderHook(() => useJobPolling('job-1', { onError }))

    await waitFor(() => {
      expect(result.current.error).toBe(networkError)
    })

    expect(onError).toHaveBeenCalledWith(networkError)
    expect(result.current.isPolling).toBe(false)
  })

  it('does not start polling without a job id', async () => {
    const { result } = renderHook(() => useJobPolling(null))

    await waitFor(() => {
      expect(result.current.isPolling).toBe(false)
    })

    expect(getJob).not.toHaveBeenCalled()
  })
})
