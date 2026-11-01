import { parseCents } from "@/lib/money"

export type Wallet = {
  total: number
  committed: number
  available: number
}

export function parseWallet(payload: unknown): Wallet | null {
  if (typeof payload !== "object" || payload === null) return null

  const record = payload as Record<string, unknown>
  const total = parseCents(record.total)
  const committed = parseCents(record.committed)
  const available = parseCents(record.available)

  if (total == null || committed == null || available == null) return null
  return { total, committed, available }
}
