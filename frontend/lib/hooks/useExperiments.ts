import { useQuery } from '@tanstack/react-query'
import { experimentsApi } from '../api/experiments'

export function useExperiments(showId: string) {
  return useQuery({
    queryKey: ['experiments', showId],
    queryFn: () => experimentsApi.list(showId),
    enabled: !!showId,
  })
}

export function useExperiment(experimentId: string) {
  return useQuery({
    queryKey: ['experiments', experimentId],
    queryFn: () => experimentsApi.get(experimentId),
    enabled: !!experimentId,
  })
}

export function useExperimentMetrics(experimentId: string) {
  return useQuery({
    queryKey: ['experiments', experimentId, 'metrics'],
    queryFn: () => experimentsApi.metrics(experimentId),
    enabled: !!experimentId,
  })
}
