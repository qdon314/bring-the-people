import { apiClient } from '@/shared/api/client'
import { validateShowListResponse, validateShowResponse } from '@/shared/api/validators'
import type { components } from '@/shared/api/generated/schema'

export async function listShows() {
  const response = await apiClient.get('/api/shows')
  return validateShowListResponse(response, 'GET /api/shows')
}

export async function getShow(showId: string) {
  const response = await apiClient.get('/api/shows/{show_id}', {
    path: { show_id: showId },
  })
  return validateShowResponse(response, 'GET /api/shows/{show_id}')
}

export async function createShow(body: components['schemas']['ShowCreate']) {
  const response = await apiClient.post('/api/shows', { body })
  return validateShowResponse(response, 'POST /api/shows')
}
