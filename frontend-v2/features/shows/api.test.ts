import { apiClient } from '@/shared/api/client'
import { validateShowListResponse, validateShowResponse } from '@/shared/api/validators'
import { getShow, listShows } from './api'

vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const validShow = {
  show_id: 'show-1',
  artist_name: 'Test Artist',
  city: 'New York',
  venue: 'Madison Square Garden',
  show_time: '2026-03-15T20:00:00Z',
  timezone: 'America/New_York',
  capacity: 20000,
  tickets_total: 18000,
  tickets_sold: 15000,
  currency: 'USD',
  ticket_base_url: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listShows', () => {
  it('calls apiClient.get with the correct path', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([validShow])

    await listShows()

    expect(apiClient.get).toHaveBeenCalledWith('/api/shows')
  })

  it('returns validated show list', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([validShow])

    const result = await listShows()

    expect(result).toHaveLength(1)
    expect(result[0].show_id).toBe('show-1')
  })

  it('passes the response through validateShowListResponse', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([validShow])

    const result = await listShows()

    // The validator ensures all fields are the right type
    expect(result).toEqual([validShow])
  })

  it('propagates API errors', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'))

    await expect(listShows()).rejects.toThrow('Network error')
  })

  it('throws validation error for malformed response', async () => {
    vi.mocked(apiClient.get).mockResolvedValue('not-an-array')

    await expect(listShows()).rejects.toThrow('shows must be an array')
  })
})

describe('getShow', () => {
  it('calls apiClient.get with path parameter', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(validShow)

    await getShow('show-1')

    expect(apiClient.get).toHaveBeenCalledWith('/api/shows/{show_id}', {
      path: { show_id: 'show-1' },
    })
  })

  it('returns validated show', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(validShow)

    const result = await getShow('show-1')

    expect(result.show_id).toBe('show-1')
    expect(result.artist_name).toBe('Test Artist')
  })

  it('propagates API errors', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Not found'))

    await expect(getShow('bad-id')).rejects.toThrow('Not found')
  })

  it('throws validation error for malformed response', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(null)

    await expect(getShow('show-1')).rejects.toThrow()
  })
})
