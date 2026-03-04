'use client'

import { useQueries, useQuery } from '@tanstack/react-query'

import { listSegments } from '@/features/segments/api'
import { listFrames } from '@/features/frames/api'
import { listVariants } from '@/features/variants/api'
import { listExperiments } from '@/features/experiments/api'
import { listObservations } from '@/features/observations/api'
import { listMemos } from '@/features/memos/api'
import { listEvents, type EventResponse } from '@/features/events/api'
import type { CycleProgressSnapshot } from '@/features/cycles/getCycleProgress'
import { queryKeys } from '@/shared/queryKeys'

export interface UseOverviewSnapshotParams {
  showId: string
  cycleId: string
}

export interface UseOverviewSnapshotResult {
  snapshot: CycleProgressSnapshot | undefined
  events: EventResponse[] | undefined
  isLoading: boolean
  isError: boolean
  error: Error | null
}

export function useOverviewSnapshot({
  showId,
  cycleId,
}: UseOverviewSnapshotParams): UseOverviewSnapshotResult {
  // Phase 1: independent parallel queries
  const segmentsQuery = useQuery({
    queryKey: queryKeys.segments.list(showId, cycleId),
    queryFn: () => listSegments(showId, cycleId),
  })

  const framesQuery = useQuery({
    queryKey: queryKeys.frames.list(showId, cycleId),
    queryFn: () => listFrames(showId, cycleId),
  })

  const experimentsQuery = useQuery({
    queryKey: queryKeys.experiments.list(showId),
    queryFn: () => listExperiments(showId),
  })

  const memosQuery = useQuery({
    queryKey: queryKeys.memos.list(showId),
    queryFn: () => listMemos(showId),
  })

  const eventsQuery = useQuery({
    queryKey: queryKeys.events.list(showId, cycleId),
    queryFn: () => listEvents(showId, cycleId),
  })

  // Phase 2: variant queries — one per frame, enabled when frames are loaded
  const frames = framesQuery.data ?? []
  const variantQueries = useQueries({
    queries: frames.map((frame) => ({
      queryKey: queryKeys.variants.byFrame(frame.frame_id),
      queryFn: () => listVariants(frame.frame_id),
      enabled: framesQuery.isSuccess,
    })),
  })

  // Phase 2: observation queries — one per cycle experiment, enabled when experiments are loaded
  const allExperiments = experimentsQuery.data ?? []
  const cycleExperiments = allExperiments.filter((e) => e.cycle_id === cycleId)
  const observationQueries = useQueries({
    queries: cycleExperiments.map((experiment) => ({
      queryKey: queryKeys.observations.list(experiment.experiment_id),
      queryFn: () => listObservations(experiment.experiment_id),
      enabled: experimentsQuery.isSuccess,
    })),
  })

  // Aggregate loading/error states
  const phase1Queries = [segmentsQuery, framesQuery, experimentsQuery, memosQuery, eventsQuery]
  const isPhase1Loading = phase1Queries.some((q) => q.isPending)
  const isVariantsLoading = framesQuery.isSuccess && variantQueries.some((q) => q.isPending)
  const isObservationsLoading =
    experimentsQuery.isSuccess && observationQueries.some((q) => q.isPending)

  const isLoading = isPhase1Loading || isVariantsLoading || isObservationsLoading
  const isError =
    phase1Queries.some((q) => q.isError) ||
    variantQueries.some((q) => q.isError) ||
    observationQueries.some((q) => q.isError)

  const firstError =
    (phase1Queries.find((q) => q.isError)?.error as Error | undefined) ??
    (variantQueries.find((q) => q.isError)?.error as Error | undefined) ??
    (observationQueries.find((q) => q.isError)?.error as Error | undefined) ??
    null

  // Compose snapshot only when all data is available
  const allVariantsLoaded =
    framesQuery.isSuccess &&
    (frames.length === 0 || variantQueries.every((q) => q.isSuccess))
  const allObservationsLoaded =
    experimentsQuery.isSuccess &&
    (cycleExperiments.length === 0 || observationQueries.every((q) => q.isSuccess))

  const canCompose =
    segmentsQuery.isSuccess &&
    framesQuery.isSuccess &&
    experimentsQuery.isSuccess &&
    memosQuery.isSuccess &&
    allVariantsLoaded &&
    allObservationsLoaded

  let snapshot: CycleProgressSnapshot | undefined
  if (canCompose) {
    const cycleMemos = (memosQuery.data ?? []).filter((m) => m.cycle_id === cycleId)

    snapshot = {
      segments: segmentsQuery.data ?? [],
      frames: framesQuery.data ?? [],
      variants: variantQueries.flatMap((q) => q.data ?? []),
      experiments: cycleExperiments,
      observations: observationQueries.flatMap((q) => q.data ?? []),
      memos: cycleMemos,
    }
  }

  return {
    snapshot,
    events: eventsQuery.data,
    isLoading,
    isError,
    error: firstError,
  }
}
