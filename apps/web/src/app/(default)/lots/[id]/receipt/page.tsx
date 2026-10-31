import { cache } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { API } from "@/api/server"
import { ReceiptReport, type LotReceipt } from "@/components/lots/receipt-report"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { parseCents } from "@/lib/money"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
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

function parseWinner(value: unknown): number | null | undefined {
  if (value === null) return null
  const id = idOf(value)
  return id == null ? undefined : id
}

function parseReceipt(payload: unknown): LotReceipt | null {
  if (!isRecord(payload)) return null

  const lotId = idOf(payload.lot_id ?? payload.lotId)
  const amount = parseCents(payload.amount)
  const settledAt = readDate(payload.settled_at ?? payload.settledAt)
  const winner = parseWinner(payload.winner)
  if (lotId == null || amount == null || !settledAt || winner === undefined) return null

  return {
    lotId: String(lotId),
    title: text(payload.title) || "Lote",
    imageUrl: httpUrl(payload.image_url ?? payload.imageUrl),
    amount: winner == null ? 0 : amount,
    winner,
    settledAt,
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

const loadReceipt = cache(async (id: string): Promise<LotReceipt | "missing" | "error"> => {
  if (!/^[1-9]\d*$/.test(id)) return "missing"

  try {
    const response = await API.get(`/lots/${encodeURIComponent(id)}/receipt`)
    if (response.status === 404) return "missing"
    if (!response.ok) return "error"

    const receipt = parseReceipt(await readPayload(response))
    if (!receipt) return "error"
    return receipt
  } catch {
    return "error"
  }
})

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const receipt = await loadReceipt(id)

  if (receipt === "missing" || receipt === "error") return { title: "Comprovante — Arremata" }
  return { title: `${receipt.title} — Comprovante — Arremata` }
}

function ReceiptError() {
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
        <AlertTitle>Não foi possível carregar o comprovante</AlertTitle>
        <AlertDescription>A página não recebeu os dados da liquidação. Tente de novo em instantes.</AlertDescription>
      </Alert>
    </main>
  )
}

export default async function LotReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const receipt = await loadReceipt(id)

  if (receipt === "missing") notFound()
  if (receipt === "error") return <ReceiptError />

  return <ReceiptReport receipt={receipt} />
}
