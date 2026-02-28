export class ApiResponseValidationError extends Error {
  readonly endpoint: string
  readonly issues: string[]
  readonly payload: unknown

  constructor(endpoint: string, issues: string[], payload: unknown) {
    super(`Invalid API response for ${endpoint}: ${issues.join('; ')}`)
    this.name = 'ApiResponseValidationError'
    this.endpoint = endpoint
    this.issues = issues
    this.payload = payload
  }
}

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as UnknownRecord
}

export function expectRecord(value: unknown, field: string, issues: string[]): UnknownRecord {
  const record = asRecord(value)
  if (!record) {
    issues.push(`${field} must be an object`)
    return {}
  }
  return record
}

export function expectString(
  record: UnknownRecord,
  field: string,
  issues: string[],
  options: { nullable?: boolean; optional?: boolean } = {}
): string | null | undefined {
  const value = record[field]

  if (value === undefined) {
    if (!options.optional) {
      issues.push(`${field} is required`)
    }
    return undefined
  }

  if (value === null) {
    if (options.nullable) {
      return null
    }
    issues.push(`${field} must be a string`)
    return null
  }

  if (typeof value !== 'string') {
    issues.push(`${field} must be a string`)
    return undefined
  }

  return value
}

export function expectNumber(
  record: UnknownRecord,
  field: string,
  issues: string[],
  options: { nullable?: boolean; optional?: boolean } = {}
): number | null | undefined {
  const value = record[field]

  if (value === undefined) {
    if (!options.optional) {
      issues.push(`${field} is required`)
    }
    return undefined
  }

  if (value === null) {
    if (options.nullable) {
      return null
    }
    issues.push(`${field} must be a number`)
    return null
  }

  if (typeof value !== 'number' || Number.isNaN(value)) {
    issues.push(`${field} must be a number`)
    return undefined
  }

  return value
}

export function assertValid<T>(
  endpoint: string,
  payload: unknown,
  issues: string[],
  value: T
): T {
  if (issues.length > 0) {
    throw new ApiResponseValidationError(endpoint, issues, payload)
  }

  return value
}
