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

const emptyCyclesShow = {
  show_id: 'show-empty',
  artist_name: 'Empty Show',
  city: 'Nashville',
  venue: 'The Bluebird',
  show_time: '2026-06-01T20:00:00Z',
  timezone: 'America/Chicago',
  capacity: 100,
  tickets_total: 100,
  tickets_sold: 0,
  currency: 'USD',
  ticket_base_url: null,
}

export const defaultCycles = [
  {
    cycle_id: 'cycle-1',
    show_id: 'show-1',
    started_at: '2026-02-01T00:00:00Z',
    label: 'Cycle 1 · Feb 1–7',
  },
  {
    cycle_id: 'cycle-2',
    show_id: 'show-1',
    started_at: '2026-02-08T00:00:00Z',
    label: 'Cycle 2 · Feb 8–14',
  },
]

export const handlers = [
  http.get(`${API_BASE_URL}/api/shows`, () => {
    return HttpResponse.json([defaultShow, emptyCyclesShow])
  }),
  http.get(`${API_BASE_URL}/api/shows/:showId`, ({ params }) => {
    const { showId } = params

    if (showId === defaultShow.show_id) {
      return HttpResponse.json(defaultShow)
    }

    if (showId === emptyCyclesShow.show_id) {
      return HttpResponse.json(emptyCyclesShow)
    }

    return HttpResponse.json({ detail: 'Show not found' }, { status: 404 })
  }),
  http.get(`${API_BASE_URL}/api/shows/:showId/cycles`, ({ params }) => {
    const { showId } = params

    if (showId === defaultShow.show_id) {
      return HttpResponse.json(defaultCycles)
    }

    if (showId === emptyCyclesShow.show_id) {
      return HttpResponse.json([])
    }

    return HttpResponse.json({ detail: 'Show not found' }, { status: 404 })
  }),
  http.get(`${API_BASE_URL}/api/cycles/:cycleId`, ({ params }) => {
    const { cycleId } = params
    const cycle = defaultCycles.find((c) => c.cycle_id === cycleId)

    if (cycle) {
      return HttpResponse.json(cycle)
    }

    return HttpResponse.json({ detail: 'Cycle not found' }, { status: 404 })
  }),
  http.post(`${API_BASE_URL}/api/shows/:showId/cycles`, ({ params }) => {
    const showId = String(params.showId)
    return HttpResponse.json(
      {
        cycle_id: 'cycle-new',
        show_id: showId,
        started_at: '2026-03-05T00:00:00Z',
        label: null,
      },
      { status: 201 },
    )
  }),
]
