import { apiClient } from '@/shared/api/client'
import { getJob } from './api'

vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const validJob = {
  job_id: 'job-1',
  job_type: 'strategy',
  status: 'running',
  show_id: 'show-1',
  result_json: null,
  error_message: null,
  attempt_count: 0,
  created_at: '2026-02-27T12:00:00Z',
  updated_at: '2026-02-27T12:00:00Z',
  completed_at: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getJob', () => {
  it('calls apiClient.get with path params', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(validJob)

    await getJob('job-1')

    expect(apiClient.get).toHaveBeenCalledWith('/api/jobs/{job_id}', {
      path: { job_id: 'job-1' },
    })
  })

  it('returns validated job response', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(validJob)

    const result = await getJob('job-1')

    expect(result.job_id).toBe('job-1')
    expect(result.status).toBe('running')
  })

  it('throws on validation failure', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: 'done' })

    await expect(getJob('job-1')).rejects.toThrow('status must be one of queued|running|completed|failed')
  })
})
