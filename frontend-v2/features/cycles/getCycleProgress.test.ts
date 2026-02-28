import { getCycleProgress, type CycleProgressSnapshot } from './getCycleProgress'

function makeSnapshot(overrides: Partial<CycleProgressSnapshot> = {}): CycleProgressSnapshot {
  return {
    segments: [],
    frames: [],
    variants: [],
    experiments: [],
    observations: [],
    memos: [],
    ...overrides,
  }
}

describe('getCycleProgress', () => {
  it('returns all false and nextAction plan for empty snapshot', () => {
    const progress = getCycleProgress(makeSnapshot())

    expect(progress.planComplete).toBe(false)
    expect(progress.createComplete).toBe(false)
    expect(progress.runComplete).toBe(false)
    expect(progress.resultsComplete).toBe(false)
    expect(progress.memoComplete).toBe(false)
    expect(progress.nextAction).toBe('plan')
  })

  it('returns plan as next action when no approved segment and frame exist', () => {
    const progress = getCycleProgress(
      makeSnapshot({
        segments: [{ review_status: 'pending' }],
        frames: [{ frame_id: 'frame-1', review_status: 'approved' }],
      })
    )

    expect(progress.planComplete).toBe(false)
    expect(progress.nextAction).toBe('plan')
  })

  it('marks create complete only when an approved variant belongs to an approved frame', () => {
    const progress = getCycleProgress(
      makeSnapshot({
        segments: [{ review_status: 'approved' }],
        frames: [
          { frame_id: 'frame-1', review_status: 'rejected' },
          { frame_id: 'frame-2', review_status: 'approved' },
        ],
        variants: [
          { frame_id: 'frame-1', review_status: 'approved' },
          { frame_id: 'frame-2', review_status: 'approved' },
        ],
      })
    )

    expect(progress.planComplete).toBe(true)
    expect(progress.createComplete).toBe(true)
    expect(progress.nextAction).toBe('run')
  })

  it('marks run complete for active experiments', () => {
    const progress = getCycleProgress(
      makeSnapshot({
        segments: [{ review_status: 'approved' }],
        frames: [{ frame_id: 'frame-1', review_status: 'approved' }],
        variants: [{ frame_id: 'frame-1', review_status: 'approved' }],
        experiments: [{ experiment_id: 'exp-1', status: 'active' }],
      })
    )

    expect(progress.runComplete).toBe(true)
  })

  it('marks run complete for decided experiments', () => {
    const progress = getCycleProgress(
      makeSnapshot({
        segments: [{ review_status: 'approved' }],
        frames: [{ frame_id: 'frame-1', review_status: 'approved' }],
        variants: [{ frame_id: 'frame-1', review_status: 'approved' }],
        experiments: [{ experiment_id: 'exp-1', status: 'decided' }],
      })
    )

    expect(progress.runComplete).toBe(true)
  })

  it('does not mark run complete for draft experiments', () => {
    const progress = getCycleProgress(
      makeSnapshot({
        segments: [{ review_status: 'approved' }],
        frames: [{ frame_id: 'frame-1', review_status: 'approved' }],
        variants: [{ frame_id: 'frame-1', review_status: 'approved' }],
        experiments: [{ experiment_id: 'exp-1', status: 'draft' }],
      })
    )

    expect(progress.runComplete).toBe(false)
    expect(progress.nextAction).toBe('run')
  })

  it('marks results complete only with observations for launched experiments', () => {
    const progress = getCycleProgress(
      makeSnapshot({
        segments: [{ review_status: 'approved' }],
        frames: [{ frame_id: 'frame-1', review_status: 'approved' }],
        variants: [{ frame_id: 'frame-1', review_status: 'approved' }],
        experiments: [{ experiment_id: 'exp-1', status: 'draft' }],
        observations: [{ experiment_id: 'exp-1' }],
      })
    )

    expect(progress.runComplete).toBe(false)
    expect(progress.resultsComplete).toBe(false)
    expect(progress.nextAction).toBe('run')
  })

  it('returns memo as next action when all prior steps are complete', () => {
    const progress = getCycleProgress(
      makeSnapshot({
        segments: [{ review_status: 'approved' }],
        frames: [{ frame_id: 'frame-1', review_status: 'approved' }],
        variants: [{ frame_id: 'frame-1', review_status: 'approved' }],
        experiments: [{ experiment_id: 'exp-1', status: 'active' }],
        observations: [{ experiment_id: 'exp-1' }],
      })
    )

    expect(progress.planComplete).toBe(true)
    expect(progress.createComplete).toBe(true)
    expect(progress.runComplete).toBe(true)
    expect(progress.resultsComplete).toBe(true)
    expect(progress.memoComplete).toBe(false)
    expect(progress.nextAction).toBe('memo')
  })

  it('returns complete when all steps are complete', () => {
    const progress = getCycleProgress(
      makeSnapshot({
        segments: [{ review_status: 'approved' }],
        frames: [{ frame_id: 'frame-1', review_status: 'approved' }],
        variants: [{ frame_id: 'frame-1', review_status: 'approved' }],
        experiments: [{ experiment_id: 'exp-1', status: 'decided' }],
        observations: [{ experiment_id: 'exp-1' }],
        memos: [{ memo_id: 'memo-1' }],
      })
    )

    expect(progress.nextAction).toBe('complete')
  })

  it('prioritizes earlier incomplete steps in nextAction order', () => {
    const progress = getCycleProgress(
      makeSnapshot({
        segments: [{ review_status: 'approved' }],
        frames: [{ frame_id: 'frame-1', review_status: 'approved' }],
        experiments: [{ experiment_id: 'exp-1', status: 'decided' }],
      })
    )

    expect(progress.runComplete).toBe(true)
    expect(progress.createComplete).toBe(false)
    expect(progress.nextAction).toBe('create')
  })
})
