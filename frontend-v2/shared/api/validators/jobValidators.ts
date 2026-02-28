import type { components } from '@/shared/api/generated/schema'
import { ApiResponseValidationError, assertValid, expectNumber, expectRecord, expectString } from './primitives'

type JobResponse = components['schemas']['JobResponse']

const JOB_STATUSES = new Set(['queued', 'running', 'completed', 'failed'])

function expectNullableRecord(
  record: Record<string, unknown>,
  field: string,
  issues: string[]
): Record<string, unknown> | null {
  const value = record[field]

  if (value === undefined) {
    issues.push(`${field} is required`)
    return null
  }

  if (value === null) {
    return null
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    issues.push(`${field} must be an object or null`)
    return null
  }

  return value as Record<string, unknown>
}

export function validateJobResponse(payload: unknown, endpoint: string): JobResponse {
  const issues: string[] = []
  const record = expectRecord(payload, 'job', issues)

  const status = expectString(record, 'status', issues) ?? ''
  if (status && !JOB_STATUSES.has(status)) {
    issues.push(`status must be one of queued|running|completed|failed`)
  }

  const job = {
    job_id: expectString(record, 'job_id', issues) ?? '',
    job_type: expectString(record, 'job_type', issues) ?? '',
    status,
    show_id: expectString(record, 'show_id', issues) ?? '',
    result_json: expectNullableRecord(record, 'result_json', issues),
    error_message: expectString(record, 'error_message', issues, { nullable: true }) ?? null,
    attempt_count: expectNumber(record, 'attempt_count', issues) ?? 0,
    created_at: expectString(record, 'created_at', issues) ?? '',
    updated_at: expectString(record, 'updated_at', issues) ?? '',
    completed_at: expectString(record, 'completed_at', issues, { nullable: true }) ?? null,
  } satisfies JobResponse

  return assertValid(endpoint, payload, issues, job)
}

export function validateJobListResponse(payload: unknown, endpoint: string): JobResponse[] {
  if (!Array.isArray(payload)) {
    throw new ApiResponseValidationError(endpoint, ['jobs must be an array'], payload)
  }

  return payload.map((item) => validateJobResponse(item, endpoint))
}
