import type { components } from '@/shared/api/generated/schema'

type SegmentSnapshot = Pick<components['schemas']['SegmentResponse'], 'review_status'>
type FrameSnapshot = Pick<components['schemas']['FrameResponse'], 'frame_id' | 'review_status'>
type VariantSnapshot = Pick<components['schemas']['VariantResponse'], 'frame_id' | 'review_status'>
type ExperimentSnapshot = Pick<components['schemas']['ExperimentResponse'], 'experiment_id' | 'status'>
type ObservationSnapshot = Pick<components['schemas']['ObservationResponse'], 'experiment_id'>
type MemoSnapshot = Pick<components['schemas']['MemoResponse'], 'memo_id'>

export interface CycleProgressSnapshot {
  segments: readonly SegmentSnapshot[]
  frames: readonly FrameSnapshot[]
  variants: readonly VariantSnapshot[]
  experiments: readonly ExperimentSnapshot[]
  observations: readonly ObservationSnapshot[]
  memos: readonly MemoSnapshot[]
}

export type CycleNextAction = 'plan' | 'create' | 'run' | 'results' | 'memo' | 'complete'

export interface CycleProgress {
  planComplete: boolean
  createComplete: boolean
  runComplete: boolean
  resultsComplete: boolean
  memoComplete: boolean
  nextAction: CycleNextAction
}

/** Experiment statuses that indicate the experiment has been launched. */
const LAUNCHED_STATUSES = new Set(['active', 'decided'])

function isApproved(reviewStatus: components['schemas']['ReviewStatus']): boolean {
  return reviewStatus === 'approved'
}

export function getCycleProgress(snapshot: CycleProgressSnapshot): CycleProgress {
  const approvedFrameIds = new Set(
    snapshot.frames
      .filter((frame) => isApproved(frame.review_status))
      .map((frame) => frame.frame_id)
  )

  const launchedExperimentIds = new Set(
    snapshot.experiments
      .filter((experiment) => LAUNCHED_STATUSES.has(experiment.status))
      .map((experiment) => experiment.experiment_id)
  )

  const planComplete =
    snapshot.segments.some((segment) => isApproved(segment.review_status)) &&
    approvedFrameIds.size > 0

  const createComplete = snapshot.variants.some(
    (variant) => isApproved(variant.review_status) && approvedFrameIds.has(variant.frame_id)
  )

  const runComplete = launchedExperimentIds.size > 0

  const resultsComplete = snapshot.observations.some((observation) =>
    launchedExperimentIds.has(observation.experiment_id)
  )

  const memoComplete = snapshot.memos.length > 0

  if (!planComplete) {
    return { planComplete, createComplete, runComplete, resultsComplete, memoComplete, nextAction: 'plan' }
  }

  if (!createComplete) {
    return { planComplete, createComplete, runComplete, resultsComplete, memoComplete, nextAction: 'create' }
  }

  if (!runComplete) {
    return { planComplete, createComplete, runComplete, resultsComplete, memoComplete, nextAction: 'run' }
  }

  if (!resultsComplete) {
    return { planComplete, createComplete, runComplete, resultsComplete, memoComplete, nextAction: 'results' }
  }

  if (!memoComplete) {
    return { planComplete, createComplete, runComplete, resultsComplete, memoComplete, nextAction: 'memo' }
  }

  return { planComplete, createComplete, runComplete, resultsComplete, memoComplete, nextAction: 'complete' }
}
