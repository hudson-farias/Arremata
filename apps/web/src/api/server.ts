import { cookies } from 'next/headers'

type SearchParams = Record<string, string | string[] | undefined>

const apiBaseURL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')

class ApiServer {
  private async headers(): Promise<Record<string, string>> {
    const cookieStore = await cookies()
    const token = cookieStore.get('TOKEN')?.value

    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  private withQuery(endpoint: string, query?: string | SearchParams) {
    if (!query) return endpoint

    if (typeof query === 'string') {
      return query ? `${endpoint}?${query}` : endpoint
    }

    const search = new URLSearchParams()

    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string' && value) search.set(key, value)
    }

    const qs = search.toString()
    return qs ? `${endpoint}?${qs}` : endpoint
  }

  async request(method: string, endpoint: string, body?: unknown): Promise<Response> {
    const headers = await this.headers()

    return fetch(`${apiBaseURL}${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    })
  }

  get(endpoint: string, query?: string | SearchParams): Promise<Response> {
    return this.request('GET', this.withQuery(endpoint, query))
  }

  post(endpoint: string, body: unknown): Promise<Response> {
    return this.request('POST', endpoint, body)
  }

  put(endpoint: string, body: unknown): Promise<Response> {
    return this.request('PUT', endpoint, body)
  }

  patch(endpoint: string, body: unknown): Promise<Response> {
    return this.request('PATCH', endpoint, body)
  }

  delete(endpoint: string): Promise<Response> {
    return this.request('DELETE', endpoint)
  }

  async verifyAuthenticated(): Promise<boolean> {
    const response = await this.get('/me')
    return response.status === 204
  }

  async isAuthenticated(): Promise<boolean> {
    const cookieStore = await cookies()
    const isAuth = cookieStore.get('ISAUTH')?.value
    return isAuth === 'true'
  }
}

export const API = new ApiServer()
