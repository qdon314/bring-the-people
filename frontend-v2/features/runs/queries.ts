'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { runKeys } from '@/shared/queryKeys'
import {
  listRunsByCycle,
  listRunsByExperiment,
  getRun,
  createRun,
  launchRun,
  requestRunReapproval,
  type RunCreate,
} from './api'

export function useRunsByCycle(cycleId: string) {
  return useQuery({
    queryKey: runKeys.listByCycle(cycleId),
    queryFn: () => listRunsByCycle(cycleId),
    enabled: !!cycleId,
  })
}

export function useRunsByExperiment(experimentId: string) {
  return useQuery({
    queryKey: runKeys.listByExperiment(experimentId),
    queryFn: () => listRunsByExperiment(experimentId),
    enabled: !!experimentId,
  })
}

export function useRun(runId: string) {
  return useQuery({
    queryKey: runKeys.detail(runId),
    queryFn: () => getRun(runId),
    enabled: !!runId,
  })
}

export function useCreateRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RunCreate) => createRun(body),
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: runKeys.listByCycle(run.cycle_id) })
      qc.invalidateQueries({ queryKey: runKeys.listByExperiment(run.experiment_id) })
    },
  })
}

export function useLaunchRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) => launchRun(runId),
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: runKeys.detail(run.run_id) })
      qc.invalidateQueries({ queryKey: runKeys.listByCycle(run.cycle_id) })
    },
  })
}

export function useRequestRunReapproval() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (runId: string) => requestRunReapproval(runId),
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: runKeys.detail(run.run_id) })
      qc.invalidateQueries({ queryKey: runKeys.listByCycle(run.cycle_id) })
    },
  })
}
