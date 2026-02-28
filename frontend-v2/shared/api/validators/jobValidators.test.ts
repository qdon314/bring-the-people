import { ApiResponseValidationError } from './primitives'
import { validateJobListResponse, validateJobResponse } from './jobValidators'

const validJob = {
  job_id: 'job-1',
  job_type: 'strategy',
  status: 'running',
  show_id: 'show-1',
  result_json: null,
  error_message: null,
  attempt_count: 1,
  created_at: '2026-02-27T12:00:00Z',
  updated_at: '2026-02-27T12:00:01Z',
  completed_at: null,
}

describe('validateJobResponse', () => {
  it('returns a typed job for valid payload', () => {
    const result = validateJobResponse(validJob, 'GET /api/jobs/{job_id}')

    expect(result.job_id).toBe('job-1')
    expect(result.status).toBe('running')
  })

  it('throws for unsupported status', () => {
    expect(() =>
      validateJobResponse(
        {
          ...validJob,
          status: 'done',
        },
        'GET /api/jobs/{job_id}'
      )
    ).toThrow('status must be one of queued|running|completed|failed')
  })

  it('throws when payload is not an object', () => {
    expect(() => validateJobResponse(null, 'GET /api/jobs/{job_id}')).toThrow(
      ApiResponseValidationError
    )
  })
})

describe('validateJobListResponse', () => {
  it('returns validated jobs when payload is an array', () => {
    const result = validateJobListResponse([validJob], 'GET /api/jobs')

    expect(result).toHaveLength(1)
    expect(result[0].job_id).toBe('job-1')
  })

  it('throws when payload is not an array', () => {
    expect(() => validateJobListResponse(validJob, 'GET /api/jobs')).toThrow(
      'jobs must be an array'
    )
  })
})
