import { ApiError } from '@/shared/api/client'
import { mapApiError } from './mapApiError'

describe('mapApiError', () => {
  it('maps network failures to connection copy', () => {
    const mappedError = mapApiError(new TypeError('Failed to fetch'))

    expect(mappedError).toEqual({
      title: 'Connection issue',
      message: 'We could not reach the server. Check your connection and try again.',
      retryable: true,
      fieldErrors: [],
    })
  })

  it('maps typed 404 errors to entity-specific not-found copy', () => {
    const mappedError = mapApiError(new ApiError(404, 'Show not found', { detail: 'Show not found' }))

    expect(mappedError).toEqual({
      title: 'Show not found',
      message: 'It may have been removed or is no longer available. Refresh and try again.',
      retryable: true,
      fieldErrors: [],
    })
  })

  it('maps 409 errors to state-conflict copy', () => {
    const mappedError = mapApiError(
      new ApiError(409, 'Cannot launch from status draft', {
        detail: 'Cannot launch from status draft',
      })
    )

    expect(mappedError).toEqual({
      title: 'State conflict',
      message: 'This item changed state and the action is no longer valid. Refresh and try again.',
      retryable: true,
      fieldErrors: [],
    })
  })

  it('extracts field errors from FastAPI 422 validation payloads', () => {
    const mappedError = mapApiError(
      new ApiError(422, 'HTTP 422', {
        detail: [
          { loc: ['body', 'city'], msg: 'Field required', type: 'missing' },
          {
            loc: ['body', 'capacity'],
            msg: 'Input should be greater than 0',
            type: 'greater_than',
          },
        ],
      })
    )

    expect(mappedError).toEqual({
      title: 'Check your input',
      message: 'Some values need attention before you can continue.',
      retryable: false,
      fieldErrors: ['Field required', 'Input should be greater than 0'],
    })
  })

  it('extracts constraint violations from creative 422 payloads', () => {
    const mappedError = mapApiError(
      new ApiError(422, 'HTTP 422', {
        error: 'Constraint violations detected',
        violations: ['Variant 0 hook exceeds 80 chars'],
      })
    )

    expect(mappedError).toEqual({
      title: 'Check your input',
      message: 'Some values need attention before you can continue.',
      retryable: false,
      fieldErrors: ['Variant 0 hook exceeds 80 chars'],
    })
  })

  it('maps 502 errors to agent-run retry copy', () => {
    const mappedError = mapApiError(new ApiError(502, 'Bad Gateway', { detail: 'Bad Gateway' }))

    expect(mappedError).toEqual({
      title: 'Agent run failed',
      message: 'The agent could not finish this run. Retry to start a new run.',
      retryable: true,
      fieldErrors: [],
    })
  })

  it('uses action-aware copy for generic 5xx errors', () => {
    const mappedError = mapApiError(new ApiError(500, 'HTTP 500', { detail: 'HTTP 500' }), {
      action: 'save this show',
    })

    expect(mappedError).toEqual({
      title: 'Server error',
      message: 'The server hit an error while trying to save this show. Try again in a moment.',
      retryable: true,
      fieldErrors: [],
    })
  })

  it('keeps unknown raw messages only in fallback details', () => {
    const mappedError = mapApiError(new Error('Socket closed unexpectedly'))

    expect(mappedError).toEqual({
      title: 'Something went wrong',
      message: 'We could not complete this request. Try again or refresh the page.',
      retryable: true,
      fieldErrors: [],
      fallbackDetail: 'Socket closed unexpectedly',
    })
  })
})
