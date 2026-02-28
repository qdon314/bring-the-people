import type { components } from '@/shared/api/generated/schema'
import {
  ApiResponseValidationError,
  assertValid,
  expectNumber,
  expectRecord,
  expectString,
} from '@/shared/api/validators/primitives'

type ShowResponse = components['schemas']['ShowResponse']

export function validateShowResponse(payload: unknown, endpoint: string): ShowResponse {
  const issues: string[] = []
  const record = expectRecord(payload, 'show', issues)

  const show = {
    show_id: expectString(record, 'show_id', issues) ?? '',
    artist_name: expectString(record, 'artist_name', issues) ?? '',
    city: expectString(record, 'city', issues) ?? '',
    venue: expectString(record, 'venue', issues) ?? '',
    show_time: expectString(record, 'show_time', issues) ?? '',
    timezone: expectString(record, 'timezone', issues) ?? '',
    capacity: expectNumber(record, 'capacity', issues) ?? 0,
    tickets_total: expectNumber(record, 'tickets_total', issues) ?? 0,
    tickets_sold: expectNumber(record, 'tickets_sold', issues) ?? 0,
    currency: expectString(record, 'currency', issues) ?? '',
    ticket_base_url: expectString(record, 'ticket_base_url', issues, {
      nullable: true,
      optional: true,
    }),
  } satisfies ShowResponse

  return assertValid(endpoint, payload, issues, show)
}

export function validateShowListResponse(payload: unknown, endpoint: string): ShowResponse[] {
  if (!Array.isArray(payload)) {
    throw new ApiResponseValidationError(endpoint, ['shows must be an array'], payload)
  }

  return payload.map((item) => validateShowResponse(item, endpoint))
}
