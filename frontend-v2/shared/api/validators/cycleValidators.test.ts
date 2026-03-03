import { describe, it, expect } from 'vitest'
import { ApiResponseValidationError } from '@/shared/api/validators/primitives'
import { validateCycleResponse, validateCycleListResponse } from './cycleValidators'

const validCycle = {
  cycle_id: 'cycle-1',
  show_id: 'show-1',
  started_at: '2026-02-01T00:00:00Z',
  label: 'Cycle 1 · Feb 1–7',
}

describe('validateCycleResponse', () => {
  it('accepts a valid cycle with a label', () => {
    const result = validateCycleResponse(validCycle, 'test')

    expect(result).toEqual(validCycle)
  })

  it('accepts a cycle with null label', () => {
    const cycle = { ...validCycle, label: null }
    const result = validateCycleResponse(cycle, 'test')

    expect(result.label).toBeNull()
  })

  it('returns null label when label field is absent', () => {
    const { label: _, ...cycleWithoutLabel } = validCycle
    const result = validateCycleResponse(cycleWithoutLabel, 'test')

    // CycleResponse.label is string | null, so absent label is coerced to null
    expect(result.label).toBeNull()
  })

  it('throws ApiResponseValidationError when cycle_id is missing', () => {
    const { cycle_id: _, ...invalid } = validCycle

    expect(() => validateCycleResponse(invalid, 'GET /api/shows/{show_id}/cycles')).toThrow(
      ApiResponseValidationError
    )
  })

  it('throws ApiResponseValidationError when show_id is missing', () => {
    const { show_id: _, ...invalid } = validCycle

    expect(() => validateCycleResponse(invalid, 'GET /api/shows/{show_id}/cycles')).toThrow(
      ApiResponseValidationError
    )
  })

  it('throws ApiResponseValidationError when started_at is missing', () => {
    const { started_at: _, ...invalid } = validCycle

    expect(() => validateCycleResponse(invalid, 'GET /api/shows/{show_id}/cycles')).toThrow(
      ApiResponseValidationError
    )
  })

  it('throws ApiResponseValidationError when payload is not an object', () => {
    expect(() => validateCycleResponse('not an object', 'test')).toThrow(ApiResponseValidationError)
  })
})

describe('validateCycleListResponse', () => {
  it('accepts an array of valid cycles', () => {
    const result = validateCycleListResponse([validCycle, { ...validCycle, cycle_id: 'cycle-2' }], 'test')

    expect(result).toHaveLength(2)
    expect(result[0].cycle_id).toBe('cycle-1')
    expect(result[1].cycle_id).toBe('cycle-2')
  })

  it('accepts an empty array', () => {
    const result = validateCycleListResponse([], 'test')

    expect(result).toEqual([])
  })

  it('throws ApiResponseValidationError when payload is not an array', () => {
    expect(() => validateCycleListResponse({ not: 'an array' }, 'test')).toThrow(
      ApiResponseValidationError
    )
  })
})
