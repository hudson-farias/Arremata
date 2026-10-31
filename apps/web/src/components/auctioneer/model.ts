import { formatCents, parseCents } from "@/lib/money"

export type CatalogCard = {
  id: string
  name: string
  setName: string
  rarity: string
  number: string
  imageSmall: string | null
  imageLarge: string | null
}

export type LotStatus = "scheduled" | "live" | "closed" | "cancelled"

export type LotResult = {
  winner: number | null
  amount: number | null
}

export type AuctionLot = {
  id: string
  title: string
  imageUrl: string | null
  status: LotStatus | null
  bidCount: number
  minimumBid: number | null
  increment: number | null
  startsAt: string | null
  endsAt: string | null
  setName: string
  rarity: string
  number: string
  result: LotResult | null
}

const lotStatuses: readonly LotStatus[] = ["scheduled", "live", "closed", "cancelled"]

const statusLabels: Record<LotStatus, string> = {
  scheduled: "Agendado",
  live: "Ao vivo",
  closed: "Encerrado",
  cancelled: "Cancelado",
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
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

function money(value: unknown): number | null {
  return parseCents(value)
}

function count(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.floor(value)
  if (typeof value !== "string" || !value.trim()) return 0

  const parsed = Number(value.trim())
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.floor(parsed)
}

function asList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (!isRecord(payload)) return []

  for (const key of ["cards", "lots", "items", "results", "data"]) {
    if (Array.isArray(payload[key])) return payload[key]
  }

  return []
}

function imageFrom(record: Record<string, unknown>, key: "small" | "large"): string | null {
  const flat = httpUrl(record[key === "small" ? "image_small" : "image_large"])
  if (flat) return flat

  if (!isRecord(record.images)) return null
  return httpUrl(record.images[key])
}

export function parseCard(value: unknown): CatalogCard | null {
  if (!isRecord(value)) return null

  const id = text(value.id)
  const name = text(value.name)
  if (!id || !name) return null

  return {
    id,
    name,
    setName: text(value.set_name),
    rarity: text(value.rarity),
    number: text(value.number),
    imageSmall: imageFrom(value, "small"),
    imageLarge: imageFrom(value, "large"),
  }
}

export function parseCards(payload: unknown): CatalogCard[] {
  const list = asList(payload)
  const source = list.length > 0 ? list : [payload]
  const cards: CatalogCard[] = []
  const seen = new Set<string>()

  for (const item of source) {
    const card = parseCard(item)
    if (!card || seen.has(card.id)) continue
    seen.add(card.id)
    cards.push(card)
  }

  return cards
}

function statusOf(value: unknown): LotStatus | null {
  const raw = text(value).toLowerCase()
  return lotStatuses.find((status) => status === raw) ?? null
}

function publicId(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value
  if (typeof value === "string" && /^[1-9]\d*$/.test(value.trim())) {
    const parsed = Number(value.trim())
    if (Number.isSafeInteger(parsed)) return parsed
  }
  return null
}

function readDate(value: unknown): string | null {
  if (typeof value !== "string") return null
  const raw = value.trim()
  if (!raw || Number.isNaN(Date.parse(raw))) return null
  return raw
}

function parseResult(value: unknown): LotResult | null {
  if (!isRecord(value)) return null

  return {
    winner: publicId(value.winner),
    amount: money(value.amount),
  }
}

export function parseLot(value: unknown): AuctionLot | null {
  if (!isRecord(value)) return null

  const id = text(value.id)
  if (!id) return null

  const attributes = isRecord(value.attributes) ? value.attributes : {}
  const title = text(value.title) || text(value.name) || "Lote"

  return {
    id,
    title,
    imageUrl: httpUrl(value.image_url) ?? httpUrl(value.image_large) ?? httpUrl(value.image_small),
    status: statusOf(value.status),
    bidCount: count(value.bid_count),
    minimumBid: money(value.minimum_bid),
    increment: money(value.increment),
    startsAt: readDate(value.starts_at),
    endsAt: readDate(value.ends_at),
    setName: text(attributes.set_name) || text(value.set_name),
    rarity: text(attributes.rarity) || text(value.rarity),
    number: text(attributes.number) || text(value.number),
    result: parseResult(value.result),
  }
}

export function parseLots(payload: unknown): AuctionLot[] {
  const list = asList(payload)
  const source = list.length > 0 ? list : isRecord(payload) && text(payload.id) ? [payload] : []
  const lots: AuctionLot[] = []
  const seen = new Set<string>()

  for (const item of source) {
    const lot = parseLot(item)
    if (!lot || seen.has(lot.id)) continue
    seen.add(lot.id)
    lots.push(lot)
  }

  return lots
}

export function cardImage(card: CatalogCard): string | null {
  return card.imageLarge ?? card.imageSmall
}

export function defaultLotTitle(card: CatalogCard): string {
  return card.setName ? `${card.name} — ${card.setName}` : card.name
}

export function statusLabel(status: LotStatus | null): string {
  if (!status) return "Outro"
  return statusLabels[status]
}

export function canCancelLot(lot: AuctionLot): boolean {
  return lot.status === "scheduled" || lot.status === "live"
}

export function formatMoney(value: number | null): string {
  if (value == null) return "—"
  return formatCents(value)
}

export function formatCollectorNumber(number: string): string {
  if (!number) return "—"
  return number.startsWith("#") ? number : `#${number}`
}

export function minimumBidTotal(lots: AuctionLot[]): number | null {
  const values = lots.flatMap((lot) =>
    lot.status !== "cancelled" && lot.minimumBid != null ? [lot.minimumBid] : [],
  )
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0)
}

export function receivedTotal(lots: AuctionLot[]): number {
  return lots.reduce((sum, lot) => {
    if (lot.status !== "closed") return sum
    const amount = lot.result?.amount
    if (lot.result?.winner == null || amount == null) return sum
    return sum + amount
  }, 0)
}
