import { ApiError, apiClient } from './client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain' },
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ApiError', () => {
  it('has status, body, and message properties', () => {
    const error = new ApiError(404, 'Not Found', { detail: 'Not Found' })

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ApiError')
    expect(error.status).toBe(404)
    expect(error.message).toBe('Not Found')
    expect(error.body).toEqual({ detail: 'Not Found' })
  })
})

describe('apiClient.get', () => {
  it('makes a GET request to the correct URL', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]))

    await apiClient.get('/api/shows' as never, {} as never)

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/shows',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('returns parsed JSON body on success', async () => {
    const data = [{ show_id: '1', artist_name: 'Test' }]
    vi.mocked(fetch).mockResolvedValue(jsonResponse(data))

    const result = await apiClient.get('/api/shows' as never, {} as never)

    expect(result).toEqual(data)
  })

  it('replaces path parameters', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ show_id: '123' }))

    await apiClient.get('/api/shows/{show_id}' as never, {
      path: { show_id: '123' },
    } as never)

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/shows/123',
      expect.any(Object)
    )
  })

  it('encodes special characters in path parameters', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}))

    await apiClient.get('/api/shows/{show_id}' as never, {
      path: { show_id: 'a/b c' },
    } as never)

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/shows/a%2Fb%20c',
      expect.any(Object)
    )
  })

  it('appends query parameters', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]))

    await apiClient.get('/api/shows' as never, {
      query: { limit: 10, offset: 0 },
    } as never)

    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain('?')
    expect(url).toContain('limit=10')
    expect(url).toContain('offset=0')
  })

  it('skips null and undefined query parameters', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]))

    await apiClient.get('/api/shows' as never, {
      query: { limit: 10, offset: null, search: undefined },
    } as never)

    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain('limit=10')
    expect(url).not.toContain('offset')
    expect(url).not.toContain('search')
  })

  it('handles array query parameters', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]))

    await apiClient.get('/api/shows' as never, {
      query: { tags: ['rock', 'pop'] },
    } as never)

    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain('tags=rock')
    expect(url).toContain('tags=pop')
  })

  it('omits query string when query is empty', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]))

    await apiClient.get('/api/shows' as never, {
      query: {},
    } as never)

    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toBe('http://localhost:8000/api/shows')
  })
})

describe('apiClient.post', () => {
  it('sends JSON body with Content-Type header', async () => {
    const body = { artist_name: 'Test', city: 'NYC' }
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ show_id: '1' }, 201))

    await apiClient.post('/api/shows' as never, { body } as never)

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/shows',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      })
    )
  })
})

describe('error handling', () => {
  it('throws ApiError with detail string from JSON error response', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ detail: 'Show not found' }, 404))

    try {
      await apiClient.get('/api/shows/{show_id}' as never, {
        path: { show_id: 'bad-id' },
      } as never)
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      const apiError = error as ApiError
      expect(apiError.status).toBe(404)
      expect(apiError.message).toBe('Show not found')
      expect(apiError.body).toEqual({ detail: 'Show not found' })
    }
  })

  it('throws ApiError with JSON-stringified detail for object detail', async () => {
    const detail = { type: 'validation_error', errors: ['field required'] }
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ detail }, 422))

    try {
      await apiClient.get('/api/shows' as never, {} as never)
    } catch (error) {
      const apiError = error as ApiError
      expect(apiError.message).toBe(JSON.stringify(detail))
    }
  })

  it('throws ApiError with status code when no detail in JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: 'something' }, 500))

    try {
      await apiClient.get('/api/shows' as never, {} as never)
    } catch (error) {
      const apiError = error as ApiError
      expect(apiError.message).toBe('HTTP 500')
    }
  })

  it('throws ApiError with text body for non-JSON error response', async () => {
    vi.mocked(fetch).mockResolvedValue(textResponse('Internal Server Error', 500))

    try {
      await apiClient.get('/api/shows' as never, {} as never)
    } catch (error) {
      const apiError = error as ApiError
      expect(apiError.status).toBe(500)
      expect(apiError.message).toBe('Internal Server Error')
    }
  })

  it('returns undefined for 204 No Content responses', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))

    const result = await apiClient.delete('/api/shows/{show_id}' as never, {
      path: { show_id: '123' },
    } as never)

    expect(result).toBeUndefined()
  })
})

describe('request options', () => {
  it('passes signal to fetch for abort support', async () => {
    const controller = new AbortController()
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]))

    await apiClient.get('/api/shows' as never, {
      signal: controller.signal,
    } as never)

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal })
    )
  })

  it('passes custom headers', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]))

    await apiClient.get('/api/shows' as never, {
      headers: { 'X-Custom': 'value' },
    } as never)

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Custom': 'value' }),
      })
    )
  })
})
