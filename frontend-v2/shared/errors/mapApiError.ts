import { ApiError } from '@/shared/api/client'

const DEFAULT_ACTION = 'complete this request'

export interface MappedApiError {
  title: string
  message: string
  retryable: boolean
  fieldErrors: string[]
  fallbackDetail?: string
}

interface MapApiErrorOptions {
  action?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toTitleCase(value: string): string {
  if (!value) return value
  return `${value[0].toUpperCase()}${value.slice(1).toLowerCase()}`
}

function extractPrimaryDetail(body: unknown, fallbackMessage: string): string {
  if (isRecord(body)) {
    if (typeof body.detail === 'string' && body.detail.trim().length > 0) {
      return body.detail
    }

    if (typeof body.error === 'string' && body.error.trim().length > 0) {
      return body.error
    }
  }

  if (typeof body === 'string' && body.trim().length > 0) {
    return body
  }

  return fallbackMessage
}

function extractFallbackDetail(message: string): string | undefined {
  const trimmedMessage = message.trim()
  if (!trimmedMessage || /^HTTP \d+$/.test(trimmedMessage)) {
    return undefined
  }

  return trimmedMessage
}

function extractValidationMessages(body: unknown): string[] {
  if (!isRecord(body)) return []

  if (Array.isArray(body.violations)) {
    const violationMessages = body.violations.filter(
      (value): value is string => typeof value === 'string' && value.trim().length > 0
    )

    if (violationMessages.length > 0) {
      return violationMessages
    }
  }

  if (Array.isArray(body.detail)) {
    const detailMessages = body.detail
      .map((detailItem) => {
        if (!isRecord(detailItem)) return null
        return typeof detailItem.msg === 'string' && detailItem.msg.trim().length > 0
          ? detailItem.msg
          : null
      })
      .filter((message): message is string => message !== null)

    if (detailMessages.length > 0) {
      return detailMessages
    }
  }

  if (typeof body.detail === 'string' && body.detail.trim().length > 0) {
    return [body.detail]
  }

  if (typeof body.error === 'string' && body.error.trim().length > 0) {
    return [body.error]
  }

  return []
}

function mapNotFoundTitle(detail: string): string {
  if (!/not found/i.test(detail)) {
    return 'Resource not found'
  }

  const entityMatch = detail.match(
    /\b(show|cycle|segment|frame|variant|experiment|memo|job)\b/i
  )

  if (!entityMatch) {
    return 'Resource not found'
  }

  return `${toTitleCase(entityMatch[1])} not found`
}

function defaultFallbackError(action: string, error?: Error): MappedApiError {
  return {
    title: 'Something went wrong',
    message: `We could not ${action}. Try again or refresh the page.`,
    retryable: true,
    fieldErrors: [],
    fallbackDetail: error ? extractFallbackDetail(error.message) : undefined,
  }
}

export function mapApiError(
  error: unknown,
  { action = DEFAULT_ACTION }: MapApiErrorOptions = {}
): MappedApiError {
  const normalizedAction = action.trim().length > 0 ? action : DEFAULT_ACTION

  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      title: 'Request cancelled',
      message: 'This request was cancelled before it finished. Try again if needed.',
      retryable: true,
      fieldErrors: [],
    }
  }

  if (error instanceof TypeError) {
    return {
      title: 'Connection issue',
      message: 'We could not reach the server. Check your connection and try again.',
      retryable: true,
      fieldErrors: [],
    }
  }

  if (error instanceof ApiError) {
    const detail = extractPrimaryDetail(error.body, error.message)

    if (error.status === 400) {
      return {
        title: 'Invalid request',
        message: 'Some inputs are invalid. Review your entries and try again.',
        retryable: false,
        fieldErrors: [],
      }
    }

    if (error.status === 401) {
      return {
        title: 'Sign in required',
        message: 'Your session is missing or expired. Sign in and try again.',
        retryable: true,
        fieldErrors: [],
      }
    }

    if (error.status === 403) {
      return {
        title: 'Access denied',
        message: 'You do not have permission to perform this action.',
        retryable: false,
        fieldErrors: [],
      }
    }

    if (error.status === 404) {
      return {
        title: mapNotFoundTitle(detail),
        message: 'It may have been removed or is no longer available. Refresh and try again.',
        retryable: true,
        fieldErrors: [],
      }
    }

    if (error.status === 409) {
      return {
        title: 'State conflict',
        message: 'This item changed state and the action is no longer valid. Refresh and try again.',
        retryable: true,
        fieldErrors: [],
      }
    }

    if (error.status === 422) {
      return {
        title: 'Check your input',
        message: 'Some values need attention before you can continue.',
        retryable: false,
        fieldErrors: extractValidationMessages(error.body),
      }
    }

    if (error.status === 429) {
      return {
        title: 'Too many requests',
        message: 'Please wait a moment, then try again.',
        retryable: true,
        fieldErrors: [],
      }
    }

    if (error.status === 502) {
      return {
        title: 'Agent run failed',
        message: 'The agent could not finish this run. Retry to start a new run.',
        retryable: true,
        fieldErrors: [],
      }
    }

    if (error.status >= 500) {
      return {
        title: 'Server error',
        message: `The server hit an error while trying to ${normalizedAction}. Try again in a moment.`,
        retryable: true,
        fieldErrors: [],
      }
    }

    return {
      ...defaultFallbackError(normalizedAction, error),
      fallbackDetail: extractFallbackDetail(detail) ?? extractFallbackDetail(error.message),
    }
  }

  if (error instanceof Error) {
    return defaultFallbackError(normalizedAction, error)
  }

  return defaultFallbackError(normalizedAction)
}
