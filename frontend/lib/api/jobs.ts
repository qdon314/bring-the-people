import { client } from './client'
import type { BackgroundJob } from '../types'

export const jobsApi = {
  get: (jobId: string) => client.get<BackgroundJob>(`/api/jobs/${jobId}`),
}
