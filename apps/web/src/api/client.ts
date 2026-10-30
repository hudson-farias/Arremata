import nookies from 'nookies'

type SearchParams = Record<string, string | string[] | undefined>

const apiBaseURL = '/backend'

class ApiClient {
  private headers(method: string, isForm: boolean = false): Record<string, string> {
    const token = nookies.get(null).TOKEN

    const headers: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }

    if (!isForm && method !== 'GET' && method !== 'HEAD') {
      headers['Content-Type'] = 'application/json'
    }

    return headers
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

  private async request(method: string, endpoint: string, body?: unknown): Promise<Response> {
    const isForm = body instanceof FormData
    const headers = this.headers(method, isForm)
    const payload = isForm ? body : body !== undefined ? JSON.stringify(body) : undefined

    const response = await fetch(`${apiBaseURL}${endpoint}`, {
      method,
      headers,
      body: payload,
      credentials: 'include',
    })

    return response
  }

  private storeToken(accessToken: string) {
    nookies.set(null, 'TOKEN', accessToken, {
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
      sameSite: 'lax',
    })
  }

  async login(loginData: object): Promise<Response> {
    const response = await fetch(`${apiBaseURL}/login`, {
      method: 'POST',
      headers: this.headers('POST'),
      body: JSON.stringify(loginData),
      credentials: 'include',
    })

    if (response.status === 201) {
      const data: { access_token: string } = await response.json()
      if (data['access_token']) this.storeToken(data['access_token'])
    }

    return response
  }

  setToken(data: { access_token: string }, redirect: string = '/') {
    if (data['access_token']) this.storeToken(data['access_token'])

    window.location.href = redirect
  }

  logout() {
    nookies.destroy(null, 'TOKEN', { path: '/' })
    nookies.destroy(null, 'ISAUTH', { path: '/' })

    window.location.href = '/login'
  }

  setAuthenticated(isAuthenticated: boolean) {
    nookies.set(null, 'ISAUTH', isAuthenticated ? 'true' : 'false', {
      path: '/',
      sameSite: 'lax',
    })
  }

  async isAuthenticated(): Promise<boolean> {
    const isAuth = nookies.get(null).ISAUTH
    return isAuth === 'true'
  }

  async checkAuth(): Promise<boolean> {
    const token = nookies.get(null).TOKEN

    const response = await fetch(`${apiBaseURL}/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      cache: 'no-store',
    })

    return response.status === 204
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
}

export const API = new ApiClient()
