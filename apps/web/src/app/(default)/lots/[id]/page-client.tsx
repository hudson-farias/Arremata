"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { BidConsole } from "@/components/lots/bid-console"
import { ConditionReport } from "@/components/lots/condition-report"
import { lotLiveURL, parseLiveLotEvent } from "@/components/lots/live"
import { LotShowcase } from "@/components/lots/lot-showcase"
import {
  bidFloorCents,
  formatLotMoney,
  mergeLiveLot,
  topBid,
  userIsLeading,
  type ShowcaseLot,
} from "@/components/lots/model"
import { reaisToCents } from "@/lib/money"

const maxCents = 999999999999
const reconnectDelayMs = 1000

type PlaceBidResult = {
  status: number
  message?: string
  lot?: ShowcaseLot
  leading?: boolean
}

type Seat = "winning" | "outbid" | null

function reaisInput(cents: number | null): string {
  if (cents == null) return ""
  return (cents / 100).toFixed(2)
}

function parseReais(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const normalized = trimmed.includes(",") && !trimmed.includes(".") ? trimmed.replace(",", ".") : trimmed
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null

  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return value
}

function endsMoved(previous: string | null, next: string | null): boolean {
  if (!previous || !next) return false

  const left = Date.parse(previous)
  const right = Date.parse(next)
  return !Number.isNaN(left) && !Number.isNaN(right) && right > left
}

function formatRemaining(endsAt: string, now: number): string | null {
  const end = Date.parse(endsAt)
  if (Number.isNaN(end)) return null

  const diff = end - now
  if (diff <= 0) return "Encerrado"

  const totalSeconds = Math.floor(diff / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`
}

function bidSignature(lot: ShowcaseLot): string {
  return `${lot.id}:${lot.currentBid ?? ""}:${lot.bidCount}:${lot.increment ?? ""}:${lot.endsAt ?? ""}`
}

function initialSeat(lot: ShowcaseLot, viewerId: number | null): Seat {
  if (viewerId == null) return null
  if (userIsLeading(lot, viewerId)) return "winning"
  if (lot.bids.some((bid) => bid.bidderId === viewerId)) return "outbid"
  return null
}

function nextSeat(lot: ShowcaseLot, viewerId: number | null, leading: boolean, previous: Seat): Seat {
  if (leading) return "winning"
  if (viewerId != null && lot.bids.some((bid) => bid.bidderId === viewerId)) return "outbid"
  if (previous === "winning" || previous === "outbid") return "outbid"
  return null
}

export default function LotPageClient({
  lot: initialLot,
  condition,
  viewerId: initialViewerId,
  placeBid,
}: {
  lot: ShowcaseLot
  condition: string | null
  viewerId: number | null
  placeBid: (id: string, amount: number) => Promise<PlaceBidResult>
}) {
  const router = useRouter()
  const signature = bidSignature(initialLot)
  const [seen, setSeen] = useState(signature)
  const [lot, setLot] = useState(initialLot)
  const [viewerId, setViewerId] = useState(initialViewerId)
  const [leading, setLeading] = useState(() => userIsLeading(initialLot, initialViewerId))
  const [position, setPosition] = useState<Seat>(() => initialSeat(initialLot, initialViewerId))
  const [amount, setAmount] = useState(() => reaisInput(bidFloorCents(initialLot)))
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [now, setNow] = useState<number | null>(null)
  const [visitEnd, setVisitEnd] = useState(initialLot.endsAt)
  const [extended, setExtended] = useState(false)
  const lotRef = useRef(lot)
  const viewerRef = useRef(viewerId)
  const leadingRef = useRef(leading)
  const positionRef = useRef(position)
  const applyRef = useRef<(event: { lot: ShowcaseLot; leading: boolean }) => void>(() => {})

  lotRef.current = lot
  viewerRef.current = viewerId
  leadingRef.current = leading
  positionRef.current = position

  if (initialViewerId != null && viewerId !== initialViewerId) {
    viewerRef.current = initialViewerId
    setViewerId(initialViewerId)
  }

  if (lot.id !== initialLot.id) {
    const nextLeading = userIsLeading(initialLot, initialViewerId)
    lotRef.current = initialLot
    viewerRef.current = initialViewerId
    leadingRef.current = nextLeading
    positionRef.current = initialSeat(initialLot, initialViewerId)
    setSeen(signature)
    setLot(initialLot)
    setViewerId(initialViewerId)
    setLeading(nextLeading)
    setPosition(positionRef.current)
    setAmount(reaisInput(bidFloorCents(initialLot)))
    setError(null)
    setVisitEnd(initialLot.endsAt)
    setExtended(false)
  } else if (lot.endsAt !== visitEnd || seen !== signature) {
    if (lot.endsAt !== visitEnd) {
      if (endsMoved(visitEnd, lot.endsAt)) setExtended(true)
      setVisitEnd(lot.endsAt)
    }

    if (seen !== signature) {
      setSeen(signature)
      setLot((current) => {
        const next = mergeLiveLot(current, initialLot)
        lotRef.current = next
        return next
      })
    }
  }

  applyRef.current = (event) => {
    const current = lotRef.current
    const merged = mergeLiveLot(current, event.lot)
    const previousFloor = bidFloorCents(current)
    const nextFloor = bidFloorCents(merged)
    const viewer = viewerRef.current
    const wasLeading = leadingRef.current
    const seat = nextSeat(merged, viewer, event.leading, positionRef.current)

    lotRef.current = merged
    leadingRef.current = event.leading
    positionRef.current = seat
    setLot(merged)
    setLeading(event.leading)
    setPosition(seat)

    if (previousFloor != null && nextFloor != null && nextFloor > previousFloor) {
      setAmount((value) => (value === reaisInput(previousFloor) ? reaisInput(nextFloor) : value))
    }

    if (viewer != null && wasLeading !== event.leading) {
      router.refresh()
    }
  }

  useEffect(() => {
    let stopped = false
    let socket: WebSocket | null = null
    let retry: number | null = null

    const connect = () => {
      if (stopped) return

      const next = new WebSocket(lotLiveURL(initialLot.id))
      socket = next

      next.onmessage = (message) => {
        if (stopped || socket !== next || typeof message.data !== "string") return

        const event = parseLiveLotEvent(message.data)
        if (!event || event.lot.id !== initialLot.id) return
        applyRef.current(event)
      }

      next.onclose = (event) => {
        if (stopped || socket !== next || event.code === 1008) return
        retry = window.setTimeout(connect, reconnectDelayMs)
      }
    }

    connect()

    return () => {
      stopped = true
      if (retry != null) window.clearTimeout(retry)
      socket?.close()
    }
  }, [initialLot.id])

  const ticking = lot.status === "live" && Boolean(lot.endsAt)

  useEffect(() => {
    setNow(Date.now())
    if (!ticking) return

    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [ticking])

  const remaining = ticking && now != null && lot.endsAt ? formatRemaining(lot.endsAt, now) : null
  const open = lot.status === "live" && remaining !== "Encerrado"

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!open || pending) return

    const reais = parseReais(amount)
    const cents = reais == null ? null : reaisToCents(reais)

    if (cents == null) {
      setError("Informe um valor numérico.")
      return
    }

    if (cents > maxCents) {
      setError("O lance passa do teto.")
      return
    }

    const reference = bidFloorCents(lot)

    if (reference == null) {
      setError("Não há lance de referência para este lote.")
      return
    }

    if (cents < reference) {
      setError(`O lance mínimo é ${formatLotMoney(reference)}.`)
      return
    }

    setPending(true)
    setError(null)

    try {
      const result = await placeBid(lot.id, cents)

      if (result.status === 401) {
        window.location.href = `/login?next=/lots/${lot.id}`
        return
      }

      if (result.status < 200 || result.status >= 300 || !result.lot) {
        setError(result.message ?? "Não foi possível enviar o lance.")
        return
      }

      if (result.leading) {
        const winner = topBid(result.lot)
        if (winner) {
          viewerRef.current = winner.bidderId
          setViewerId(winner.bidderId)
        }
      }

      applyRef.current({ lot: result.lot, leading: result.leading === true })
      setAmount(reaisInput(bidFloorCents(lotRef.current)))
      toast.success("Lance enviado.")
    } catch {
      setError("Não foi possível enviar o lance.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="relative flex flex-1 flex-col bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,var(--primary),transparent_55%)] opacity-[0.07]"
      />

      <main className="relative mx-auto grid w-full max-w-7xl grid-cols-1 items-start gap-8 px-6 py-8 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <LotShowcase lot={lot} />
          <ConditionReport text={condition} />
        </div>
        <div className="lg:col-span-5">
          <BidConsole
            lot={lot}
            remaining={remaining}
            extended={extended && lot.status === "live"}
            open={open}
            position={position}
            viewerId={viewerId}
            amount={amount}
            error={error}
            pending={pending}
            onAmountChange={(value) => {
              setAmount(value)
              setError(null)
            }}
            onSubmit={onSubmit}
          />
        </div>
      </main>
    </div>
  )
}
