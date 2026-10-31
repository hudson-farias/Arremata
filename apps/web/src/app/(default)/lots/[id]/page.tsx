import { cache } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { API } from "@/api/server"
import { parseShowcaseLot, type ShowcaseLot } from "@/components/lots/model"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { parseCents, reaisToCents } from "@/lib/money"

import LotPageClient from "./page-client"

type LotView = {
  lot: ShowcaseLot
  condition: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function moneyForParser(value: unknown): unknown {
  if (value == null || parseCents(value) != null) return value

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return reaisToCents(value) ?? value
  }

  if (typeof value !== "string") return value

  const normalized = value.trim().replace(/\s/g, "").replace(",", ".")
  if (!/^\d+\.\d+$/.test(normalized)) return value

  return reaisToCents(Number(normalized)) ?? value
}

function readCondition(record: Record<string, unknown>): string | null {
  const attributes = isRecord(record.attributes) ? record.attributes : {}
  const candidates = [record.description, record.condition, attributes.description, attributes.condition]

  for (const candidate of candidates) {
    const value = text(candidate)
    if (value) return value
  }

  return null
}

function normalizeBids(value: unknown): unknown {
  if (!Array.isArray(value)) return value

  return value.map((bid) => {
    if (!isRecord(bid)) return bid
    return { ...bid, amount: moneyForParser(bid.amount) }
  })
}

function normalize(payload: unknown): unknown {
  if (!isRecord(payload)) return payload

  const current = payload.current_bid ?? payload.currentBid

  return {
    ...payload,
    minimum_bid: moneyForParser(payload.minimum_bid ?? payload.minimumBid),
    increment: moneyForParser(payload.increment ?? payload.increment_cents),
    current_bid: current == null ? null : moneyForParser(current),
    bids: normalizeBids(payload.bids),
  }
}

function detailMessage(payload: unknown): string {
  if (!isRecord(payload) || typeof payload.detail !== "string" || !payload.detail.trim()) {
    return "Não foi possível enviar o lance."
  }

  return payload.detail.trim()
}

async function sessionUserId(): Promise<number | null> {
  const jar = await cookies()
  const token = jar.get("TOKEN")?.value
  if (!token) return null

  const parts = token.split(".")
  if (parts.length !== 3) return null

  const [id, expires, signature] = parts
  if (!/^[1-9]\d*$/.test(id) || !/^\d+$/.test(expires) || !signature) return null

  const userId = Number(id)
  if (!Number.isSafeInteger(userId)) return null
  return userId
}

async function placeBid(
  id: string,
  amount: number,
): Promise<{ status: number; message?: string; lot?: ShowcaseLot; leading?: boolean }> {
  "use server"

  if (!/^[1-9]\d*$/.test(id)) return { status: 400, message: "Lote inválido." }
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 999999999999) {
    return { status: 400, message: "Informe um valor numérico." }
  }

  let response: Response

  try {
    response = await API.post(`/lots/${id}/bids`, { amount })
  } catch {
    return { status: 0, message: "Não foi possível enviar o lance." }
  }

  const payload = normalize(await readPayload(response))

  if (response.status === 401) return { status: 401 }
  if (!response.ok) return { status: response.status, message: detailMessage(payload) }

  const lot = parseShowcaseLot(payload)
  if (!lot) return { status: 502, message: "Não foi possível ler o lance." }

  return {
    status: response.status,
    lot,
    leading: isRecord(payload) && payload.leading === true,
  }
}

async function readPayload(response: Response): Promise<unknown> {
  const body = await response.text()
  if (!body) return null

  try {
    return JSON.parse(body) as unknown
  } catch {
    return null
  }
}

const loadLot = cache(async (id: string): Promise<LotView | "missing" | "error"> => {
  if (!/^[1-9]\d*$/.test(id)) return "missing"

  try {
    const response = await API.get(`/lots/${encodeURIComponent(id)}`)
    if (response.status === 404) return "missing"
    if (!response.ok) return "error"

    const payload = normalize(await readPayload(response))
    if (isRecord(payload) && text(payload.status).toLowerCase() === "cancelled") return "missing"

    const lot = parseShowcaseLot(payload)
    if (!lot || !isRecord(payload)) return "error"

    return { lot, condition: readCondition(payload) }
  } catch {
    return "error"
  }
})

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const view = await loadLot(id)

  if (view === "missing" || view === "error") return { title: "Lote — Arremata" }
  return { title: `${view.lot.title} — Arremata` }
}

function LotError() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1.5 text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase hover:text-primary"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Voltar à vitrine
      </Link>
      <Alert variant="destructive" className="rounded-[4px]">
        <AlertTitle>Não foi possível carregar este lote</AlertTitle>
        <AlertDescription>A página não recebeu os dados do pregão. Tente de novo em instantes.</AlertDescription>
      </Alert>
    </main>
  )
}

export default async function LotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const view = await loadLot(id)

  if (view === "missing") notFound()
  if (view === "error") return <LotError />

  return (
    <LotPageClient
      lot={view.lot}
      condition={view.condition}
      viewerId={await sessionUserId()}
      placeBid={placeBid}
    />
  )
}
