import { apiClient } from '@/shared/api/client'
import { validateCycleListResponse, validateCycleResponse } from '@/shared/api/validators'

export async function listCycles(showId: string) {
  const response = await apiClient.get('/api/shows/{show_id}/cycles', {
    path: { show_id: showId },
  })
  return validateCycleListResponse(response, 'GET /api/shows/{show_id}/cycles')
}

export async function getCycle(cycleId: string) {
  const response = await apiClient.get('/api/cycles/{cycle_id}', {
    path: { cycle_id: cycleId },
  })
  return validateCycleResponse(response, 'GET /api/cycles/{cycle_id}')
}

export async function createCycle(showId: string) {
  const response = await apiClient.post('/api/shows/{show_id}/cycles', {
    path: { show_id: showId },
  })
  return validateCycleResponse(response, 'POST /api/shows/{show_id}/cycles')
}
