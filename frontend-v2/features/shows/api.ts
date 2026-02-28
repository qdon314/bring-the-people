import { apiClient } from '@/shared/api/client'
import { validateShowListResponse, validateShowResponse } from '@/shared/api/validators'

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
