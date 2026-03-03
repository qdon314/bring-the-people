import { http, HttpResponse } from 'msw'
import { ApiError } from '@/shared/api/client'
import { server } from '@/test/msw/server'
import { getShow, listShows } from './api'

const validShow = {
  show_id: 'show-1',
  artist_name: 'Test Artist',
  city: 'Austin',
  venue: 'The Parish',
  show_time: '2026-05-01T20:00:00Z',
  timezone: 'America/Chicago',
  capacity: 200,
  tickets_total: 200,
  tickets_sold: 10,
  currency: 'USD',
  ticket_base_url: null,
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

describe('shows API integration (MSW)', () => {
  it('lists shows via apiClient + validator stack', async () => {
    // Override handler to return single show for this test
    server.use(
      http.get(`${API_BASE_URL}/api/shows`, () =>
        HttpResponse.json([validShow])
      )
    )

    const shows = await listShows()

    expect(shows).toEqual([validShow])
  })

  it('gets a single show via path-param route', async () => {
    const show = await getShow('show-1')

    expect(show).toEqual(validShow)
  })

  it('surfaces ApiError for a 404 response', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/shows/:showId`, () =>
        HttpResponse.json({ detail: 'Show not found' }, { status: 404 })
      )
    )

    await expect(getShow('missing-id')).rejects.toBeInstanceOf(ApiError)
  })
})
