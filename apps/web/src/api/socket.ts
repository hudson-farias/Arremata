import nookies from 'nookies'

const wsBaseURL = (process.env.NEXT_PUBLIC_WS_URL || '').replace(/\/$/, '')

class SocketClient {
  private url(endpoint: string): string | null {
    if (!wsBaseURL) return null

    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const url = new URL(`${wsBaseURL}${path}`)
    const token = nookies.get(null).TOKEN

    if (token) url.searchParams.set('token', token)
    return url.toString()
  }

  connect(endpoint: string): WebSocket | null {
    const target = this.url(endpoint)
    if (!target) return null
    return new WebSocket(target)
  }
}

export const SOCKET = new SocketClient()
