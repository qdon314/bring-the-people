import { client } from './client'

interface JobResponse {
  job_id: string
  status: string
}

export const strategyApi = {
  run: (showId: string) => client.post<JobResponse>(`/api/strategy/${showId}/run`, {}),
}
