import { client } from './client'

interface JobResponse {
  job_id: string
  status: string
}

export const creativeApi = {
  run: (frameId: string) => client.post<JobResponse>(`/api/creative/${frameId}/run`, {}),
}
