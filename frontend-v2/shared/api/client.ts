import type { paths } from '@/shared/api/generated/schema'

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'
type PathKey = keyof paths & string
type Operation<P extends PathKey, M extends HttpMethod> = Exclude<
  paths[P][M],
  undefined | never
>

type PathsWithMethod<M extends HttpMethod> = {
  [P in PathKey]: Operation<P, M> extends never ? never : P
}[PathKey]

type Params<P extends PathKey, M extends HttpMethod> = Operation<P, M> extends {
  parameters: infer T
}
  ? T
  : never

type PathParams<P extends PathKey, M extends HttpMethod> = Params<P, M> extends {
  path: infer T
}
  ? T
  : never

type QueryParams<P extends PathKey, M extends HttpMethod> = Params<P, M> extends {
  query: infer T
}
  ? T
  : never

type RequestBody<P extends PathKey, M extends HttpMethod> = Operation<P, M> extends {
  requestBody: { content: { 'application/json': infer T } }
}
  ? T
  : never

type ExtractJson<T> = T extends { content: { 'application/json': infer Body } }
  ? Body
  : never

type Responses<P extends PathKey, M extends HttpMethod> = Operation<P, M> extends {
  responses: infer T
}
  ? T
  : never

type SuccessResponse<P extends PathKey, M extends HttpMethod> =
  | (200 extends keyof Responses<P, M> ? ExtractJson<Responses<P, M>[200]> : never)
  | (201 extends keyof Responses<P, M> ? ExtractJson<Responses<P, M>[201]> : never)
  | (202 extends keyof Responses<P, M> ? ExtractJson<Responses<P, M>[202]> : never)
  | (203 extends keyof Responses<P, M> ? ExtractJson<Responses<P, M>[203]> : never)
  | (204 extends keyof Responses<P, M> ? undefined : never)

type NormalizeNever<T, Fallback = unknown> = [T] extends [never] ? Fallback : T

type PathOptions<P extends PathKey, M extends HttpMethod> = [PathParams<P, M>] extends [never]
  ? { path?: never }
  : { path: PathParams<P, M> }

type QueryOptions<P extends PathKey, M extends HttpMethod> = [QueryParams<P, M>] extends [never]
  ? { query?: never }
  : { query?: QueryParams<P, M> }

type BodyOptions<P extends PathKey, M extends HttpMethod> = [RequestBody<P, M>] extends [never]
  ? { body?: never }
  : { body: RequestBody<P, M> }

type RequestOptions<P extends PathKey, M extends HttpMethod> = PathOptions<P, M> &
  QueryOptions<P, M> &
  BodyOptions<P, M> & {
    headers?: HeadersInit
    signal?: AbortSignal
  }

type RequiresOptions<P extends PathKey, M extends HttpMethod> = [PathParams<P, M>] extends [never]
  ? [RequestBody<P, M>] extends [never]
    ? false
    : true
  : true

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

function replacePathParams(pathTemplate: string, params: Record<string, unknown>): string {
  return pathTemplate.replace(/\{([^}]+)\}/g, (_, rawKey: string) => {
    const key = rawKey as keyof typeof params
    const value = params[key]

    if (value === undefined || value === null) {
      throw new Error(`Missing required path parameter: ${rawKey}`)
    }

    return encodeURIComponent(String(value))
  })
}

function buildQueryString(query: Record<string, unknown> | undefined): string {
  if (!query) return ''

  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null) continue
        search.append(key, String(item))
      }
      continue
    }

    search.append(key, String(value))
  }

  const serialized = search.toString()
  return serialized ? `?${serialized}` : ''
}

async function parseErrorBody(response: Response): Promise<{ body: unknown; message: string }> {
  const contentType = response.headers.get('content-type')

  if (contentType?.includes('application/json')) {
    try {
      const body = (await response.json()) as { detail?: unknown }
      const message =
        typeof body?.detail === 'string'
          ? body.detail
          : body?.detail
            ? JSON.stringify(body.detail)
            : `HTTP ${response.status}`
      return { body, message }
    } catch {
      return { body: null, message: `HTTP ${response.status}` }
    }
  }

  try {
    const text = await response.text()
    return { body: text, message: text || `HTTP ${response.status}` }
  } catch {
    return { body: null, message: `HTTP ${response.status}` }
  }
}

async function parseSuccessBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined
  }

  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    return response.json()
  }

  const text = await response.text()
  return text || undefined
}

async function request<P extends PathKey, M extends HttpMethod>(
  method: M,
  pathTemplate: P,
  options?: RequestOptions<P, M>
): Promise<NormalizeNever<SuccessResponse<P, M>>> {
  const pathValue = (options as { path?: Record<string, unknown> } | undefined)?.path
  const resolvedPath = pathValue ? replacePathParams(pathTemplate, pathValue) : pathTemplate

  const queryValue = (options as { query?: Record<string, unknown> } | undefined)?.query
  const queryString = buildQueryString(queryValue)

  const body = (options as { body?: unknown } | undefined)?.body
  const headers = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(options?.headers ?? {}),
  }

  const response = await fetch(`${BASE_URL}${resolvedPath}${queryString}`, {
    method: method.toUpperCase(),
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: options?.signal,
  })

  if (!response.ok) {
    const { body: errorBody, message } = await parseErrorBody(response)
    throw new ApiError(response.status, message, errorBody)
  }

  return (await parseSuccessBody(response)) as NormalizeNever<SuccessResponse<P, M>>
}

function get<P extends PathsWithMethod<'get'>>(
  path: P,
  ...args: RequiresOptions<P, 'get'> extends true
    ? [options: RequestOptions<P, 'get'>]
    : [options?: RequestOptions<P, 'get'>]
): Promise<NormalizeNever<SuccessResponse<P, 'get'>>> {
  return request('get', path, args[0])
}

function post<P extends PathsWithMethod<'post'>>(
  path: P,
  ...args: RequiresOptions<P, 'post'> extends true
    ? [options: RequestOptions<P, 'post'>]
    : [options?: RequestOptions<P, 'post'>]
): Promise<NormalizeNever<SuccessResponse<P, 'post'>>> {
  return request('post', path, args[0])
}

function put<P extends PathsWithMethod<'put'>>(
  path: P,
  ...args: RequiresOptions<P, 'put'> extends true
    ? [options: RequestOptions<P, 'put'>]
    : [options?: RequestOptions<P, 'put'>]
): Promise<NormalizeNever<SuccessResponse<P, 'put'>>> {
  return request('put', path, args[0])
}

function patch<P extends PathsWithMethod<'patch'>>(
  path: P,
  ...args: RequiresOptions<P, 'patch'> extends true
    ? [options: RequestOptions<P, 'patch'>]
    : [options?: RequestOptions<P, 'patch'>]
): Promise<NormalizeNever<SuccessResponse<P, 'patch'>>> {
  return request('patch', path, args[0])
}

function del<P extends PathsWithMethod<'delete'>>(
  path: P,
  ...args: RequiresOptions<P, 'delete'> extends true
    ? [options: RequestOptions<P, 'delete'>]
    : [options?: RequestOptions<P, 'delete'>]
): Promise<NormalizeNever<SuccessResponse<P, 'delete'>>> {
  return request('delete', path, args[0])
}

export const apiClient = {
  get,
  post,
  put,
  patch,
  delete: del,
}

export type { PathKey, PathsWithMethod, RequestOptions, SuccessResponse }
