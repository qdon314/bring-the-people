import { http, HttpResponse } from 'msw'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const defaultShow = {
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

export const handlers = [
  http.get(`${API_BASE_URL}/api/shows`, () => {
    return HttpResponse.json([defaultShow])
  }),
  http.get(`${API_BASE_URL}/api/shows/:showId`, ({ params }) => {
    const { showId } = params

    if (showId === defaultShow.show_id) {
      return HttpResponse.json(defaultShow)
    }

    return HttpResponse.json({ detail: 'Show not found' }, { status: 404 })
  }),
]
