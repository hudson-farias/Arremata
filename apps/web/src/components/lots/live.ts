import { parseNickname, parseShowcaseLot, type ShowcaseLot } from "@/components/lots/model"

export type LiveLotEvent =
  | {
      type: "lot"
      lot: ShowcaseLot
      leading: boolean
      alias: string | null
    }
  | {
      type: "cancelled"
      lotId: string
      leading: boolean
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function lotIdOf(value: unknown): string | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value)
  if (typeof value === "string" && /^[1-9]\d*$/.test(value.trim())) return value.trim()
  return null
}

export function parseLiveLotEvent(raw: string): LiveLotEvent | null {
  let payload: unknown

  try {
    payload = JSON.parse(raw)
  } catch {
    return null
  }

  if (!isRecord(payload)) return null

  if (payload.type === "cancelled") {
    const lotId = lotIdOf(payload.lot_id ?? payload.lotId)
    if (!lotId) return null
    return { type: "cancelled", lotId, leading: payload.leading === true }
  }

  if (payload.type !== "lot") return null

  const lot = parseShowcaseLot(payload.lot)
  if (!lot) return null

  return {
    type: "lot",
    lot,
    leading: payload.leading === true,
    alias: parseNickname(payload.alias),
  }
}
