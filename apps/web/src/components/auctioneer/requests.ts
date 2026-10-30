import { API } from "@/api/client"

export const auctioneerLogin = "/login?next=/auctioneer"

export function redirectIfUnauthorized(response: Response): boolean {
  if (response.status !== 401) return false
  window.location.href = auctioneerLogin
  return true
}

export async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}
