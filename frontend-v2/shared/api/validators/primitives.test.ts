import {
  ApiResponseValidationError,
  assertValid,
  expectNumber,
  expectRecord,
  expectString,
} from './primitives'

describe('ApiResponseValidationError', () => {
  it('formats message with endpoint and issues', () => {
    const error = new ApiResponseValidationError('GET /api/shows', ['field1 is required', 'field2 must be a string'], { bad: 'data' })

    expect(error.message).toBe('Invalid API response for GET /api/shows: field1 is required; field2 must be a string')
    expect(error.name).toBe('ApiResponseValidationError')
    expect(error.endpoint).toBe('GET /api/shows')
    expect(error.issues).toEqual(['field1 is required', 'field2 must be a string'])
    expect(error.payload).toEqual({ bad: 'data' })
  })

  it('is an instance of Error', () => {
    const error = new ApiResponseValidationError('GET /test', ['issue'], null)
    expect(error).toBeInstanceOf(Error)
  })
})

describe('expectRecord', () => {
  it('returns the record when given a valid object', () => {
    const issues: string[] = []
    const result = expectRecord({ name: 'test' }, 'root', issues)

    expect(result).toEqual({ name: 'test' })
    expect(issues).toHaveLength(0)
  })

  it('pushes an issue and returns empty object for null', () => {
    const issues: string[] = []
    const result = expectRecord(null, 'root', issues)

    expect(result).toEqual({})
    expect(issues).toEqual(['root must be an object'])
  })

  it('pushes an issue and returns empty object for an array', () => {
    const issues: string[] = []
    const result = expectRecord([1, 2], 'root', issues)

    expect(result).toEqual({})
    expect(issues).toEqual(['root must be an object'])
  })

  it('pushes an issue and returns empty object for a primitive', () => {
    const issues: string[] = []
    const result = expectRecord('string', 'root', issues)

    expect(result).toEqual({})
    expect(issues).toEqual(['root must be an object'])
  })

  it('pushes an issue and returns empty object for undefined', () => {
    const issues: string[] = []
    const result = expectRecord(undefined, 'root', issues)

    expect(result).toEqual({})
    expect(issues).toEqual(['root must be an object'])
  })
})

describe('expectString', () => {
  it('returns the string when present', () => {
    const issues: string[] = []
    const result = expectString({ name: 'hello' }, 'name', issues)

    expect(result).toBe('hello')
    expect(issues).toHaveLength(0)
  })

  it('pushes an issue when a required field is missing', () => {
    const issues: string[] = []
    const result = expectString({}, 'name', issues)

    expect(result).toBeUndefined()
    expect(issues).toEqual(['name is required'])
  })

  it('does not push an issue when an optional field is missing', () => {
    const issues: string[] = []
    const result = expectString({}, 'name', issues, { optional: true })

    expect(result).toBeUndefined()
    expect(issues).toHaveLength(0)
  })

  it('returns null when value is null and nullable', () => {
    const issues: string[] = []
    const result = expectString({ name: null }, 'name', issues, { nullable: true })

    expect(result).toBeNull()
    expect(issues).toHaveLength(0)
  })

  it('pushes an issue when value is null and not nullable', () => {
    const issues: string[] = []
    const result = expectString({ name: null }, 'name', issues)

    expect(result).toBeNull()
    expect(issues).toEqual(['name must be a string'])
  })

  it('pushes an issue when value is not a string', () => {
    const issues: string[] = []
    const result = expectString({ name: 42 }, 'name', issues)

    expect(result).toBeUndefined()
    expect(issues).toEqual(['name must be a string'])
  })
})

describe('expectNumber', () => {
  it('returns the number when present', () => {
    const issues: string[] = []
    const result = expectNumber({ count: 5 }, 'count', issues)

    expect(result).toBe(5)
    expect(issues).toHaveLength(0)
  })

  it('pushes an issue when a required field is missing', () => {
    const issues: string[] = []
    const result = expectNumber({}, 'count', issues)

    expect(result).toBeUndefined()
    expect(issues).toEqual(['count is required'])
  })

  it('does not push an issue when an optional field is missing', () => {
    const issues: string[] = []
    const result = expectNumber({}, 'count', issues, { optional: true })

    expect(result).toBeUndefined()
    expect(issues).toHaveLength(0)
  })

  it('returns null when value is null and nullable', () => {
    const issues: string[] = []
    const result = expectNumber({ count: null }, 'count', issues, { nullable: true })

    expect(result).toBeNull()
    expect(issues).toHaveLength(0)
  })

  it('pushes an issue when value is null and not nullable', () => {
    const issues: string[] = []
    const result = expectNumber({ count: null }, 'count', issues)

    expect(result).toBeNull()
    expect(issues).toEqual(['count must be a number'])
  })

  it('pushes an issue when value is NaN', () => {
    const issues: string[] = []
    const result = expectNumber({ count: NaN }, 'count', issues)

    expect(result).toBeUndefined()
    expect(issues).toEqual(['count must be a number'])
  })

  it('pushes an issue when value is not a number', () => {
    const issues: string[] = []
    const result = expectNumber({ count: 'five' }, 'count', issues)

    expect(result).toBeUndefined()
    expect(issues).toEqual(['count must be a number'])
  })
})

describe('assertValid', () => {
  it('returns the value when there are no issues', () => {
    const result = assertValid('GET /test', {}, [], { data: 'valid' })
    expect(result).toEqual({ data: 'valid' })
  })

  it('throws ApiResponseValidationError when there are issues', () => {
    const payload = { bad: 'data' }

    expect(() => assertValid('GET /test', payload, ['field is required'], null)).toThrow(
      ApiResponseValidationError
    )
  })

  it('includes all issues in the thrown error', () => {
    try {
      assertValid('GET /test', {}, ['issue1', 'issue2'], null)
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiResponseValidationError)
      const validationError = error as ApiResponseValidationError
      expect(validationError.issues).toEqual(['issue1', 'issue2'])
    }
  })
})
