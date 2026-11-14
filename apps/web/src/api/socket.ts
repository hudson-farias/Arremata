const wsBaseURL = (process.env.NEXT_PUBLIC_WS_URL || '').replace(/\/$/, '')

class SocketClient {
  private url(endpoint: string): string | null {
    if (!wsBaseURL) return null

    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return `${wsBaseURL}${path}`
  }

  connect(endpoint: string): WebSocket | null {
    const target = this.url(endpoint)
    if (!target) return null
    return new WebSocket(target)
  }
}

export const SOCKET = new SocketClient()
