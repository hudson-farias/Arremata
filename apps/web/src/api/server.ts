import { cache } from 'react'
import { cookies } from 'next/headers'

export type SessionRole = 'auctioneer' | 'bidder'

type SearchParams = Record<string, string | string[] | undefined>

type Session = {
  authenticated: boolean
  role: SessionRole | null
}

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

  private loadSession = cache(async (): Promise<Session> => readSession(await this.get('/me')))

  async verifyAuthenticated(): Promise<boolean> {
    return (await this.loadSession()).authenticated
  }

  async sessionRole(accessToken?: string): Promise<SessionRole | null> {
    if (!accessToken) return (await this.loadSession()).role

    const response = await fetch(`${apiBaseURL}/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })

    return (await readSession(response)).role
  }

  async isAuthenticated(): Promise<boolean> {
    const cookieStore = await cookies()
    const isAuth = cookieStore.get('ISAUTH')?.value
    return isAuth === 'true'
  }
}

export const API = new ApiServer()

function parseRole(payload: unknown): SessionRole | null {
  if (typeof payload !== 'object' || payload === null) return null

  const role = (payload as { role?: unknown }).role
  if (role === 'auctioneer' || role === 'bidder') return role
  return null
}

async function readSession(response: Response): Promise<Session> {
  if (response.status !== 200) return { authenticated: false, role: null }

  try {
    return { authenticated: true, role: parseRole(await response.json()) }
  } catch {
    return { authenticated: true, role: null }
  }
}
