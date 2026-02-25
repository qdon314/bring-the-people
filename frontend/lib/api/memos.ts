import { client } from './client'
import type { ProducerMemo } from '../types'

interface JobResponse {
  job_id: string
  status: string
}

export const memosApi = {
  list: (showId: string) => client.get<ProducerMemo[]>(`/api/memos?show_id=${showId}`),
  get: (id: string) => client.get<ProducerMemo>(`/api/memos/${id}`),
  run: (showId: string, params: { cycle_start: string; cycle_end: string }) =>
    client.post<JobResponse>(`/api/memos/${showId}/run?cycle_start=${params.cycle_start}&cycle_end=${params.cycle_end}`, {}),
}
