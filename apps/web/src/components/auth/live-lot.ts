export type LotSummary = {
  key: string
  title: string
  code?: string
  imageUrl?: string
  edition?: string
  rarity?: string
  grade?: string
  description?: string
  detail?: string
  currentBid?: number
  minimumBid?: number
  endsAt?: string
  bidCount?: number
  registry?: string
  custody?: string
  provenance?: string
  reserveMet?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const text = value.trim()
  return text || undefined
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function readMoney(value: unknown): number | undefined {
  const direct = readNumber(value)
  if (direct != null) return direct
  if (!isRecord(value)) return undefined
  return readNumber(value.amount ?? value.value ?? value.price)
}

function readBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value
  return undefined
}

function readUrl(value: unknown): string | undefined {
  const text = readText(value)
  if (!text || text.startsWith("//")) return undefined
  if (text.startsWith("/")) return text

  try {
    const parsed = new URL(text)
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return text
  } catch {
    return undefined
  }

  return undefined
}

function readDate(value: unknown): string | undefined {
  const text = readText(value)
  if (!text || Number.isNaN(Date.parse(text))) return undefined
  return text
}

function readId(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return readText(value)
}

function clip(text: string, max = 280): string {
  if (text.length <= max) return text
  return `${text.slice(0, max).trimEnd()}…`
}

function readTitle(record: Record<string, unknown>): string | undefined {
  const direct = readText(record.title) ?? readText(record.name) ?? readText(record.card_name)
  if (direct) return direct
  if (!isRecord(record.card)) return undefined
  return readText(record.card.name) ?? readText(record.card.title)
}

function readImage(record: Record<string, unknown>): string | undefined {
  const candidates = [record.image_url, record.imageUrl, record.image, record.photo_url, record.thumbnail_url]
  for (const candidate of candidates) {
    const url = readUrl(candidate) ?? (isRecord(candidate) ? readUrl(candidate.url ?? candidate.src) : undefined)
    if (url) return url
  }
  return undefined
}

function cardOf(record: Record<string, unknown>): Record<string, unknown> | undefined {
  return isRecord(record.card) ? record.card : undefined
}

function attrsOf(record: Record<string, unknown>): Record<string, unknown> | undefined {
  return isRecord(record.attributes) ? record.attributes : undefined
}

function readEdition(record: Record<string, unknown>): string | undefined {
  const attrs = attrsOf(record)
  const card = cardOf(record)
  return (
    readText(record.edition) ??
    readText(record.set_name) ??
    readText(record.set) ??
    readText(record.expansion) ??
    readText(attrs?.edition) ??
    readText(attrs?.set) ??
    readText(card?.edition) ??
    readText(card?.set)
  )
}

function readRarity(record: Record<string, unknown>): string | undefined {
  const attrs = attrsOf(record)
  const card = cardOf(record)
  return readText(record.rarity) ?? readText(attrs?.rarity) ?? readText(card?.rarity)
}

function readGrade(record: Record<string, unknown>): string | undefined {
  const attrs = attrsOf(record)
  return (
    readText(record.grade) ??
    readText(record.grading) ??
    readText(record.condition) ??
    readText(attrs?.grade) ??
    readText(attrs?.condition)
  )
}

function readDescription(record: Record<string, unknown>): string | undefined {
  const text = readText(record.description) ?? readText(record.summary) ?? readText(record.subtitle)
  return text ? clip(text) : undefined
}

function readCode(record: Record<string, unknown>, id?: string): string | undefined {
  const explicit =
    readId(record.lot_number) ?? readId(record.number) ?? readId(record.code) ?? (id && id.length <= 12 ? id : undefined)
  if (!explicit || explicit.length > 12) return undefined
  return explicit
}

function readBidCount(record: Record<string, unknown>): number | undefined {
  const explicit = readNumber(record.bid_count ?? record.bids_count ?? record.total_bids)
  if (explicit != null && explicit >= 0) return Math.floor(explicit)
  if (Array.isArray(record.bids)) return record.bids.length
  return undefined
}

function readRegistry(record: Record<string, unknown>): string | undefined {
  return (
    readText(record.registry) ??
    readText(record.registration) ??
    readText(record.cert_number) ??
    readText(record.certificate) ??
    readId(record.psa_cert)
  )
}

function toLotSummary(value: unknown): LotSummary | null {
  if (!isRecord(value)) return null

  const status = value.status
  if (typeof status === "string" && status.toLowerCase() !== "live") return null

  const id = readId(value.id)
  const code = readCode(value, id)
  const name = readTitle(value)
  const imageUrl = readImage(value)
  const edition = readEdition(value)
  const rarity = readRarity(value)
  const grade = readGrade(value)
  const description = readDescription(value)
  const detail = typeof value.attributes === "string" ? clip(value.attributes) : undefined
  const currentBid = readMoney(value.current_bid ?? value.currentBid ?? value.highest_bid)
  const minimumBid = readMoney(value.minimum_bid ?? value.min_bid ?? value.starting_bid ?? value.initial_bid)
  const endsAt = readDate(value.ends_at ?? value.endsAt ?? value.end_time ?? value.ends)
  const bidCount = readBidCount(value)
  const registry = readRegistry(value)
  const custody = readText(value.custody) ?? readText(value.custody_location)
  const provenance = readText(value.provenance)
  const reserveMet = readBool(value.reserve_met ?? value.reserveMet ?? value.reserve_reached) === true

  const hasContent = Boolean(
    name ||
      code ||
      imageUrl ||
      edition ||
      rarity ||
      grade ||
      description ||
      detail ||
      currentBid != null ||
      minimumBid != null ||
      endsAt ||
      bidCount != null ||
      registry ||
      custody ||
      provenance
  )
  if (!hasContent) return null

  return {
    key: id ?? name ?? code ?? "lote",
    title: name ?? (code ? `Lote ${code}` : "Lote ao vivo"),
    code,
    imageUrl,
    edition,
    rarity,
    grade,
    description,
    detail,
    currentBid,
    minimumBid,
    endsAt,
    bidCount,
    registry,
    custody,
    provenance,
    reserveMet: reserveMet || undefined,
  }
}

export function pickLiveLot(payload: unknown): LotSummary | null {
  if (!Array.isArray(payload) || payload.length === 0) return null

  const lots: LotSummary[] = []
  for (const item of payload) {
    const lot = toLotSummary(item)
    if (lot) lots.push(lot)
  }

  if (lots.length === 0) return null

  const index = Math.floor(Math.random() * lots.length)
  return lots[index] ?? null
}
