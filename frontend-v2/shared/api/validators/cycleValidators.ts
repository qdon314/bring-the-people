import type { components } from '@/shared/api/generated/schema'
import {
  ApiResponseValidationError,
  assertValid,
  expectRecord,
  expectString,
} from '@/shared/api/validators/primitives'

type CycleResponse = components['schemas']['CycleResponse']

export function validateCycleResponse(payload: unknown, endpoint: string): CycleResponse {
  const issues: string[] = []
  const record = expectRecord(payload, 'cycle', issues)

  const cycle = {
    cycle_id: expectString(record, 'cycle_id', issues) ?? '',
    show_id: expectString(record, 'show_id', issues) ?? '',
    started_at: expectString(record, 'started_at', issues) ?? '',
    label: expectString(record, 'label', issues, { nullable: true, optional: true }) ?? null,
  } satisfies CycleResponse

  return assertValid(endpoint, payload, issues, cycle)
}

export function validateCycleListResponse(payload: unknown, endpoint: string): CycleResponse[] {
  if (!Array.isArray(payload)) {
    throw new ApiResponseValidationError(endpoint, ['cycles must be an array'], payload)
  }

  return payload.map((item) => validateCycleResponse(item, endpoint))
}
