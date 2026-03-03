import { http, HttpResponse } from 'msw'
import { ApiError } from '@/shared/api/client'
import { defaultCycles } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { getCycle, listCycles } from './api'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

describe('cycles API integration (MSW)', () => {
  it('lists cycles for a show via apiClient + validator stack', async () => {
    const cycles = await listCycles('show-1')

    expect(cycles).toEqual(defaultCycles)
  })

  it('gets a single cycle via path-param route', async () => {
    const cycle = await getCycle('cycle-1')

    expect(cycle).toEqual(defaultCycles[0])
  })

  it('surfaces ApiError for a 404 on listCycles', async () => {
    await expect(listCycles('missing-show')).rejects.toBeInstanceOf(ApiError)
  })

  it('surfaces ApiError for a 404 on getCycle', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/cycles/:cycleId`, () =>
        HttpResponse.json({ detail: 'Cycle not found' }, { status: 404 })
      )
    )

    await expect(getCycle('missing-cycle')).rejects.toBeInstanceOf(ApiError)
  })
})
