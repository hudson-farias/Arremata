import { formatCents, parseCents } from "@/lib/money"

export type ShowcaseStatus = "live" | "scheduled" | "closed"

export type LotsPayload = { status: number; lots: ShowcaseLot[] }

export type LotBid = {
  amount: number
  createdAt: string
  bidderId: number
  hash: string | null
}

export type ShowcaseLot = {
  id: string
  title: string
  imageUrl: string | null
  minimumBid: number | null
  increment: number | null
  currentBid: number | null
  startsAt: string | null
  endsAt: string | null
  status: ShowcaseStatus
  bidCount: number
  bids: LotBid[]
  setName: string
  rarity: string
  number: string
}

const statuses: readonly ShowcaseStatus[] = ["live", "scheduled", "closed"]

const statusLabels: Record<ShowcaseStatus, string> = {
  live: "Ao vivo",
  scheduled: "Agendado",
  closed: "Encerrado",
}

const when = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
})

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

function count(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.floor(value)
  if (typeof value !== "string" || !value.trim()) return 0

  const parsed = Number(value.trim())
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.floor(parsed)
}

function readDate(value: unknown): string | null {
  if (typeof value !== "string") return null
  const raw = value.trim()
  if (!raw || Number.isNaN(Date.parse(raw))) return null
  return raw
}

function statusOf(value: unknown): ShowcaseStatus | null {
  const raw = text(value).toLowerCase()
  return statuses.find((status) => status === raw) ?? null
}

function idOf(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value
  if (typeof value === "string" && /^[1-9]\d*$/.test(value.trim())) {
    const parsed = Number(value.trim())
    if (Number.isSafeInteger(parsed)) return parsed
  }
  return null
}

function bidHash(value: unknown): string | null {
  if (typeof value !== "string") return null
  const raw = value.trim()
  return raw || null
}

function parseBid(value: unknown): LotBid | null {
  if (!isRecord(value)) return null

  const amount = parseCents(value.amount)
  const createdAt = readDate(value.created_at ?? value.createdAt)
  const bidderId = idOf(value.bidder ?? value.bidder_id ?? value.bidderId)
  if (amount == null || !createdAt || bidderId == null) return null

  return { amount, createdAt, bidderId, hash: bidHash(value.hash) }
}

function parseBids(value: unknown): LotBid[] {
  if (!Array.isArray(value)) return []

  const bids: LotBid[] = []
  for (const item of value) {
    const bid = parseBid(item)
    if (bid) bids.push(bid)
  }
  return bids
}

export function parseShowcaseLot(value: unknown): ShowcaseLot | null {
  if (!isRecord(value)) return null

  const id = text(value.id)
  const status = statusOf(value.status)
  if (!id || !status) return null

  const attributes = isRecord(value.attributes) ? value.attributes : {}
  const currentBid = value.current_bid == null && value.currentBid == null
    ? null
    : parseCents(value.current_bid ?? value.currentBid)
  const rawIncrement = value.increment ?? value.increment_cents ?? value.incrementCents

  return {
    id,
    title: text(value.title) || text(value.name) || "Lote",
    imageUrl: httpUrl(value.image_url) ?? httpUrl(value.imageUrl),
    minimumBid: parseCents(value.minimum_bid ?? value.minimumBid),
    increment: rawIncrement == null ? null : parseCents(rawIncrement),
    currentBid,
    startsAt: readDate(value.starts_at ?? value.startsAt),
    endsAt: readDate(value.ends_at ?? value.endsAt),
    status,
    bidCount: count(value.bid_count ?? value.bidCount),
    bids: parseBids(value.bids),
    setName: text(attributes.set_name) || text(value.set_name),
    rarity: text(attributes.rarity) || text(value.rarity),
    number: text(attributes.number) || text(value.number),
  }
}

export function parseShowcaseLots(payload: unknown): ShowcaseLot[] | null {
  if (!Array.isArray(payload)) return null

  const lots: ShowcaseLot[] = []
  const seen = new Set<string>()

  for (const item of payload) {
    const lot = parseShowcaseLot(item)
    if (!lot || seen.has(lot.id)) continue
    seen.add(lot.id)
    lots.push(lot)
  }

  return lots
}

export function isShowcaseStatus(value: string): value is ShowcaseStatus {
  return statuses.some((status) => status === value)
}

export function statusLabel(status: ShowcaseStatus): string {
  return statusLabels[status]
}

export function formatLotMoney(cents: number | null): string {
  if (cents == null) return "—"
  return formatCents(cents)
}

export function bidFloorCents(lot: Pick<ShowcaseLot, "currentBid" | "minimumBid" | "increment">): number | null {
  if (lot.currentBid == null) return lot.minimumBid
  if (lot.increment == null) return null
  return lot.currentBid + lot.increment
}

export function bidFloorLabel(lot: ShowcaseLot): string | null {
  if (lot.currentBid == null) {
    if (lot.minimumBid == null) return null
    return `O mínimo é o lance inicial de ${formatLotMoney(lot.minimumBid)}.`
  }

  const floor = bidFloorCents(lot)
  if (floor == null) return null
  return `O mínimo é ${formatLotMoney(floor)}, o lance atual mais o incremento.`
}

export function bidKey(bid: LotBid): string {
  const time = Date.parse(bid.createdAt)
  const stamp = Number.isNaN(time) ? bid.createdAt : String(time)
  return `${bid.amount}:${stamp}:${bid.bidderId}`
}

function laterIso(left: string | null, right: string | null): string | null {
  const leftTime = left ? Date.parse(left) : Number.NaN
  const rightTime = right ? Date.parse(right) : Number.NaN
  if (Number.isNaN(leftTime)) return right
  if (Number.isNaN(rightTime)) return left
  return rightTime >= leftTime ? right : left
}

export function mergeLiveLot(current: ShowcaseLot, incoming: ShowcaseLot): ShowcaseLot {
  if (current.id !== incoming.id) return incoming

  const byKey = new Map<string, LotBid>()
  for (const bid of [...current.bids, ...incoming.bids]) {
    byKey.set(bidKey(bid), bid)
  }

  const bids = [...byKey.values()].sort((left, right) => {
    const time = Date.parse(right.createdAt) - Date.parse(left.createdAt)
    if (time !== 0) return time
    return right.amount - left.amount
  })

  const amounts = [current.currentBid, incoming.currentBid].filter((value): value is number => value != null)
  const incomingNewer = incoming.bidCount >= current.bidCount
  const endsAt = laterIso(current.endsAt, incoming.endsAt)

  return {
    ...incoming,
    minimumBid: incoming.minimumBid ?? current.minimumBid,
    increment: incoming.increment ?? current.increment,
    currentBid: amounts.length ? Math.max(...amounts) : null,
    startsAt: incoming.startsAt ?? current.startsAt,
    endsAt,
    status: incomingNewer ? incoming.status : current.status,
    bidCount: Math.max(current.bidCount, incoming.bidCount),
    bids: bids.slice(0, 20),
  }
}

export function topBid(lot: ShowcaseLot): LotBid | null {
  return lot.bids.reduce<LotBid | null>((best, bid) => {
    if (!best || bid.amount > best.amount) return bid
    return best
  }, null)
}

export function userIsLeading(lot: ShowcaseLot, viewerId: number | null): boolean {
  if (viewerId == null) return false
  return topBid(lot)?.bidderId === viewerId
}

export function collectorLine(lot: Pick<ShowcaseLot, "setName" | "rarity" | "number">): string {
  const number = !lot.number ? "" : lot.number.startsWith("#") ? lot.number : `#${lot.number}`
  return [lot.setName, lot.rarity, number].filter(Boolean).join(" · ")
}

export function bidCountLabel(count: number): string {
  if (count === 0) return "Nenhum lance"
  if (count === 1) return "1 lance"
  return `${count} lances`
}

export function formatLotDate(iso: string | null): string | null {
  if (!iso) return null
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return null
  return when.format(time)
}

export function matchesTitle(title: string, query: string): boolean {
  const needle = fold(query)
  if (!needle) return true
  return fold(title).includes(needle)
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR")
}
