import { ApiResponseValidationError } from './primitives'
import { validateShowListResponse, validateShowResponse } from './showValidators'

const validShow = {
  show_id: 'show-1',
  artist_name: 'Test Artist',
  city: 'New York',
  venue: 'Madison Square Garden',
  show_time: '2026-03-15T20:00:00Z',
  timezone: 'America/New_York',
  capacity: 20000,
  tickets_total: 18000,
  tickets_sold: 15000,
  currency: 'USD',
  ticket_base_url: 'https://tickets.example.com',
}

describe('validateShowResponse', () => {
  it('returns a valid show when all fields are present', () => {
    const result = validateShowResponse(validShow, 'GET /api/shows/1')

    expect(result).toEqual(validShow)
  })

  it('accepts null ticket_base_url', () => {
    const show = { ...validShow, ticket_base_url: null }
    const result = validateShowResponse(show, 'GET /api/shows/1')

    expect(result.ticket_base_url).toBeNull()
  })

  it('accepts missing ticket_base_url', () => {
    const { ticket_base_url: _, ...show } = validShow
    const result = validateShowResponse(show, 'GET /api/shows/1')

    expect(result.ticket_base_url).toBeUndefined()
  })

  it('throws when payload is not an object', () => {
    expect(() => validateShowResponse('not-an-object', 'GET /api/shows/1')).toThrow(
      ApiResponseValidationError
    )
  })

  it('throws when payload is null', () => {
    expect(() => validateShowResponse(null, 'GET /api/shows/1')).toThrow(
      ApiResponseValidationError
    )
  })

  it('throws with field-level issues for missing required fields', () => {
    try {
      validateShowResponse({}, 'GET /api/shows/1')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiResponseValidationError)
      const validationError = error as ApiResponseValidationError
      expect(validationError.issues).toContain('show_id is required')
      expect(validationError.issues).toContain('artist_name is required')
      expect(validationError.issues).toContain('capacity is required')
    }
  })

  it('throws with type issues for wrong field types', () => {
    try {
      validateShowResponse({ ...validShow, capacity: 'big', tickets_total: true }, 'GET /api/shows/1')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiResponseValidationError)
      const validationError = error as ApiResponseValidationError
      expect(validationError.issues).toContain('capacity must be a number')
      expect(validationError.issues).toContain('tickets_total must be a number')
    }
  })
})

describe('validateShowListResponse', () => {
  it('returns an array of validated shows', () => {
    const result = validateShowListResponse([validShow, { ...validShow, show_id: 'show-2' }], 'GET /api/shows')

    expect(result).toHaveLength(2)
    expect(result[0].show_id).toBe('show-1')
    expect(result[1].show_id).toBe('show-2')
  })

  it('returns an empty array for empty input', () => {
    const result = validateShowListResponse([], 'GET /api/shows')
    expect(result).toEqual([])
  })

  it('throws when payload is not an array', () => {
    expect(() => validateShowListResponse({ not: 'array' }, 'GET /api/shows')).toThrow(
      ApiResponseValidationError
    )

    try {
      validateShowListResponse('string', 'GET /api/shows')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiResponseValidationError)
      const validationError = error as ApiResponseValidationError
      expect(validationError.issues).toContain('shows must be an array')
    }
  })

  it('throws when an item in the array is invalid', () => {
    expect(() =>
      validateShowListResponse([validShow, { bad: 'data' }], 'GET /api/shows')
    ).toThrow(ApiResponseValidationError)
  })
})
