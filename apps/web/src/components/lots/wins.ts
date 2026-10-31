import { isShowcaseStatus, type ShowcaseStatus } from "@/components/lots/model"
import { parseCents } from "@/lib/money"

export type BidPosition = "winning" | "outbid" | "lost"

export type WinLot = {
  id: string
  title: string
  imageUrl: string | null
  setName: string
  rarity: string
  number: string
  amount: number
  settledAt: string | null
  winner: number
}

export type BidLot = {
  id: string
  title: string
  imageUrl: string | null
  setName: string
  rarity: string
  number: string
  status: ShowcaseStatus
  position: BidPosition
  currentBid: number | null
  userBid: number | null
}

export type WinsView = {
  won: WinLot[]
  bids: BidLot[]
}

const positions: readonly BidPosition[] = ["winning", "outbid", "lost"]

const positionLabels: Record<BidPosition, string> = {
  winning: "Ganhando",
  outbid: "Superado",
  lost: "Sem vitória",
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

function idOf(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value
  if (typeof value === "string" && /^[1-9]\d*$/.test(value.trim())) {
    const parsed = Number(value.trim())
    if (Number.isSafeInteger(parsed)) return parsed
  }
  return null
}

function httpUrl(value: unknown): string | null {
  const raw = text(value)
  if (!raw || raw.startsWith("//")) return null

  try {
    const url = new URL(raw)
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString()
  } catch {
    return null
  }

  return null
}

function readDate(value: unknown): string | null {
  if (typeof value !== "string") return null
  const raw = value.trim()
  if (!raw || Number.isNaN(Date.parse(raw))) return null
  return raw
}

function positionOf(value: unknown): BidPosition | null {
  const raw = text(value).toLowerCase()
  return positions.find((position) => position === raw) ?? null
}

function centsOrNull(value: unknown): number | null | undefined {
  if (value == null) return null
  return parseCents(value) ?? undefined
}

type CardFace = {
  id: string
  title: string
  imageUrl: string | null
  setName: string
  rarity: string
  number: string
}

function cardFace(value: Record<string, unknown>): CardFace | null {
  const id = idOf(value.id)
  if (id == null) return null

  return {
    id: String(id),
    title: text(value.title) || "Lote",
    imageUrl: httpUrl(value.image_url),
    setName: text(value.set_name),
    rarity: text(value.rarity),
    number: text(value.number),
  }
}

function parseWin(value: unknown): WinLot | null {
  if (!isRecord(value)) return null

  const face = cardFace(value)
  const amount = parseCents(value.amount)
  const winner = idOf(value.winner)
  if (!face || amount == null || winner == null) return null

  return {
    ...face,
    amount,
    settledAt: readDate(value.settled_at),
    winner,
  }
}

function parseBid(value: unknown): BidLot | null {
  if (!isRecord(value)) return null

  const face = cardFace(value)
  const status = text(value.status).toLowerCase()
  const position = positionOf(value.position)
  const currentBid = centsOrNull(value.current_bid)
  const userBid = centsOrNull(value.user_bid)
  if (!face || !isShowcaseStatus(status) || !position || currentBid === undefined || userBid === undefined) return null

  return {
    ...face,
    status,
    position,
    currentBid,
    userBid,
  }
}

function parseList<T extends { id: string }>(value: unknown, parse: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null

  const items: T[] = []
  const seen = new Set<string>()

  for (const item of value) {
    const parsed = parse(item)
    if (!parsed || seen.has(parsed.id)) continue
    seen.add(parsed.id)
    items.push(parsed)
  }

  return items
}

export function positionLabel(position: BidPosition): string {
  return positionLabels[position]
}

export function parseWins(payload: unknown): WinsView | null {
  if (!isRecord(payload)) return null

  const won = parseList(payload.won, parseWin)
  const bids = parseList(payload.bids, parseBid)
  if (!won || !bids) return null

  return { won, bids }
}
