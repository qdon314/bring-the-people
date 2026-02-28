import {
  cycleKeys,
  eventKeys,
  frameKeys,
  jobKeys,
  memoKeys,
  queryKeys,
  segmentKeys,
  showKeys,
  variantKeys,
} from './queryKeys'

describe('query key factories', () => {
  it('builds show keys', () => {
    expect(showKeys.all()).toEqual(['shows'])
    expect(showKeys.detail('show-1')).toEqual(['shows', 'detail', 'show-1'])
  })

  it('builds cycle and segment list keys', () => {
    expect(cycleKeys.list('show-1')).toEqual(['cycles', 'list', 'show-1'])
    expect(segmentKeys.list('show-1', 'cycle-1')).toEqual(['segments', 'list', 'show-1', 'cycle-1'])
  })

  it('builds keys used by job completion invalidation', () => {
    expect(frameKeys.all()).toEqual(['frames'])
    expect(variantKeys.all()).toEqual(['variants'])
    expect(memoKeys.all()).toEqual(['memos'])
    expect(eventKeys.all()).toEqual(['events'])
  })

  it('exposes all domain factories through queryKeys', () => {
    expect(queryKeys.shows).toBe(showKeys)
    expect(queryKeys.jobs).toBe(jobKeys)
  })
})
