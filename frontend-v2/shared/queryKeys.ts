export type QueryKey = readonly unknown[]

export const showKeys = {
  all: () => ['shows'] as const,
  lists: () => ['shows', 'list'] as const,
  list: () => ['shows', 'list'] as const,
  detail: (showId: string) => ['shows', 'detail', showId] as const,
} as const

export const cycleKeys = {
  all: () => ['cycles'] as const,
  lists: () => ['cycles', 'list'] as const,
  list: (showId: string) => ['cycles', 'list', showId] as const,
  detail: (cycleId: string) => ['cycles', 'detail', cycleId] as const,
} as const

export const segmentKeys = {
  all: () => ['segments'] as const,
  lists: () => ['segments', 'list'] as const,
  list: (showId: string, cycleId?: string) =>
    cycleId ? (['segments', 'list', showId, cycleId] as const) : (['segments', 'list', showId] as const),
  detail: (segmentId: string) => ['segments', 'detail', segmentId] as const,
} as const

export const frameKeys = {
  all: () => ['frames'] as const,
  lists: () => ['frames', 'list'] as const,
  list: (showId: string, cycleId?: string) =>
    cycleId ? (['frames', 'list', showId, cycleId] as const) : (['frames', 'list', showId] as const),
  detail: (frameId: string) => ['frames', 'detail', frameId] as const,
} as const

export const variantKeys = {
  all: () => ['variants'] as const,
  lists: () => ['variants', 'list'] as const,
  list: (showId: string, cycleId?: string) =>
    cycleId ? (['variants', 'list', showId, cycleId] as const) : (['variants', 'list', showId] as const),
  byFrame: (frameId: string) => ['variants', 'by-frame', frameId] as const,
  detail: (variantId: string) => ['variants', 'detail', variantId] as const,
} as const

export const experimentKeys = {
  all: () => ['experiments'] as const,
  lists: () => ['experiments', 'list'] as const,
  list: (showId: string, cycleId?: string) =>
    cycleId
      ? (['experiments', 'list', showId, cycleId] as const)
      : (['experiments', 'list', showId] as const),
  detail: (experimentId: string) => ['experiments', 'detail', experimentId] as const,
} as const

export const observationKeys = {
  all: () => ['observations'] as const,
  lists: () => ['observations', 'list'] as const,
  list: (experimentId: string) => ['observations', 'list', experimentId] as const,
  detail: (observationId: string) => ['observations', 'detail', observationId] as const,
} as const

export const decisionKeys = {
  all: () => ['decisions'] as const,
  lists: () => ['decisions', 'list'] as const,
  list: (experimentId: string) => ['decisions', 'list', experimentId] as const,
} as const

export const memoKeys = {
  all: () => ['memos'] as const,
  lists: () => ['memos', 'list'] as const,
  list: (showId: string, cycleId?: string) =>
    cycleId ? (['memos', 'list', showId, cycleId] as const) : (['memos', 'list', showId] as const),
  detail: (memoId: string) => ['memos', 'detail', memoId] as const,
} as const

export const jobKeys = {
  all: () => ['jobs'] as const,
  lists: () => ['jobs', 'list'] as const,
  list: (showId: string) => ['jobs', 'list', showId] as const,
  detail: (jobId: string) => ['jobs', 'detail', jobId] as const,
} as const

export const eventKeys = {
  all: () => ['events'] as const,
  lists: () => ['events', 'list'] as const,
  list: (showId: string, cycleId?: string) =>
    cycleId ? (['events', 'list', showId, cycleId] as const) : (['events', 'list', showId] as const),
} as const

export const queryKeys = {
  shows: showKeys,
  cycles: cycleKeys,
  segments: segmentKeys,
  frames: frameKeys,
  variants: variantKeys,
  experiments: experimentKeys,
  observations: observationKeys,
  decisions: decisionKeys,
  memos: memoKeys,
  jobs: jobKeys,
  events: eventKeys,
} as const
