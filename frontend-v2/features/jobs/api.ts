import { apiClient } from '@/shared/api/client'
import { validateJobResponse } from '@/shared/api/validators'

export async function getJob(jobId: string) {
  const response = await apiClient.get('/api/jobs/{job_id}', {
    path: { job_id: jobId },
  })

  return validateJobResponse(response, 'GET /api/jobs/{job_id}')
}
