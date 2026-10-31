"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Gavel, Search, SearchX } from "lucide-react"

import { CardPortrait } from "@/components/auctioneer/card-portrait"
import {
  bidCountLabel,
  collectorLine,
  formatLotDate,
  formatLotMoney,
  matchesTitle,
  statusLabel,
  type LotsPayload,
  type ShowcaseLot,
  type ShowcaseStatus,
} from "@/components/lots/model"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

const displayFont = "[font-family:Georgia,Palatino,'Times_New_Roman',serif]"

const filters: { value: ShowcaseStatus; label: string }[] = [
  { value: "live", label: "Ao vivo" },
  { value: "scheduled", label: "Agendados" },
  { value: "closed", label: "Encerrados" },
]

const emptyCopy: Record<ShowcaseStatus, { title: string; description: string }> = {
  live: {
    title: "Nenhum lote ao vivo",
    description: "Quando um pregão estiver aberto, a carta aparece aqui.",
  },
  scheduled: {
    title: "Nenhum lote agendado",
    description: "Os lotes com início marcado aparecem aqui.",
  },
  closed: {
    title: "Nenhum lote encerrado",
    description: "Os pregões já fechados aparecem aqui.",
  },
}

type LotsState = "loading" | "error" | "empty" | "ready"

function viewOf(payload: LotsPayload): { lots: ShowcaseLot[]; state: Exclude<LotsState, "loading"> } {
  if (payload.status < 200 || payload.status >= 300) return { lots: [], state: "error" }
  if (payload.lots.length === 0) return { lots: [], state: "empty" }
  return { lots: payload.lots, state: "ready" }
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

function StatusBadge({ status }: { status: ShowcaseStatus }) {
  const variant = status === "live" ? "default" : status === "closed" ? "secondary" : "outline"

  return (
    <Badge variant={variant} className="rounded-[4px]">
      {status === "live" ? <span className="size-1.5 animate-pulse rounded-full bg-primary-foreground" aria-hidden /> : null}
      {status === "scheduled" ? <span className="size-1.5 rounded-full bg-primary" aria-hidden /> : null}
      {statusLabel(status)}
    </Badge>
  )
}

function LotTime({ lot, now }: { lot: ShowcaseLot; now: number | null }) {
  if (lot.status === "live") {
    const remaining = now != null && lot.endsAt ? formatRemaining(lot.endsAt, now) : null

    return (
      <p className="flex flex-col items-end gap-0.5 text-right">
        <span className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">Fecha em</span>
        <span className="font-mono text-sm text-foreground">{remaining ?? "—"}</span>
      </p>
    )
  }

  const label = lot.status === "scheduled" ? "Início" : "Encerramento"
  const value = formatLotDate(lot.status === "scheduled" ? lot.startsAt : lot.endsAt)

  return (
    <p className="flex flex-col items-end gap-0.5 text-right">
      <span className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">{label}</span>
      <span className="font-mono text-sm text-foreground">{value ?? "—"}</span>
    </p>
  )
}

function LotCard({ lot, now }: { lot: ShowcaseLot; now: number | null }) {
  const specs = collectorLine(lot)
  const hasCurrent = lot.currentBid != null
  const amount = hasCurrent ? lot.currentBid : lot.minimumBid
  const amountLabel = hasCurrent ? "Lance atual" : "Lance mínimo"

  return (
    <li>
      <Link
        href={`/lots/${lot.id}`}
        className="block h-full rounded-[4px] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Card className="h-full rounded-[4px] pt-0">
          <div className="overflow-hidden bg-muted">
            <CardPortrait key={lot.imageUrl ?? lot.id} src={lot.imageUrl} alt="" className="aspect-[3/4] w-full object-contain" />
          </div>
          <CardHeader>
            <CardTitle>
              <h2 className={cn(displayFont, "text-xl leading-tight break-words")}>{lot.title}</h2>
            </CardTitle>
            {specs ? <CardDescription>{specs}</CardDescription> : null}
            <CardAction>
              <StatusBadge status={lot.status} />
            </CardAction>
          </CardHeader>
          <CardFooter className="mt-auto flex-col items-stretch gap-3">
            <div className="flex items-end justify-between gap-3">
              <p className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">{amountLabel}</span>
                <span className="font-mono text-lg text-primary">{formatLotMoney(amount)}</span>
              </p>
              <LotTime lot={lot} now={now} />
            </div>
            <p className="text-sm text-muted-foreground">{bidCountLabel(lot.bidCount)}</p>
          </CardFooter>
        </Card>
      </Link>
    </li>
  )
}

export default function LotsPageClient({
  initialLots,
  listLots,
}: {
  initialLots: LotsPayload
  listLots: (status: string) => Promise<LotsPayload>
}) {
  const initial = viewOf(initialLots)
  const [status, setStatus] = useState<ShowcaseStatus>("live")
  const [query, setQuery] = useState("")
  const [lots, setLots] = useState<ShowcaseLot[]>(initial.lots)
  const [state, setState] = useState<LotsState>(initial.state)
  const requestId = useRef(0)

  const ticking = state === "ready" && lots.some((lot) => lot.status === "live" && Boolean(lot.endsAt))
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    if (!ticking) return

    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [ticking])

  async function load(next: ShowcaseStatus) {
    const id = requestId.current + 1
    requestId.current = id
    setStatus(next)
    setState("loading")

    try {
      const payload = await listLots(next)
      if (requestId.current !== id) return
      const view = viewOf(payload)
      setLots(view.lots)
      setState(view.state)
    } catch {
      if (requestId.current !== id) return
      setLots([])
      setState("error")
    }
  }

  function selectStatus(value: string) {
    if (value !== "live" && value !== "scheduled" && value !== "closed") return
    if (value === status && state !== "error") return
    void load(value)
  }

  const visible = lots.filter((lot) => lot.status === status && matchesTitle(lot.title, query))
  const searching = query.trim().length > 0

  return (
    <div className="relative flex flex-1 flex-col bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,var(--primary),transparent_55%)] opacity-[0.07]"
      />

      <main className="relative mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-8 px-6 py-8 lg:px-12">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={status}
            onValueChange={selectStatus}
            aria-label="Estado dos lotes"
          >
            {filters.map((filter) => (
              <ToggleGroupItem key={filter.value} value={filter.value}>
                {filter.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <FieldGroup className="w-full lg:max-w-sm">
            <Field>
              <FieldLabel htmlFor="lot-search">Buscar carta</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  id="lot-search"
                  value={query}
                  placeholder="Nome no título"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </InputGroup>
            </Field>
          </FieldGroup>
        </div>

        {state === "loading" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="status" aria-live="polite">
            <span className="sr-only">Carregando lotes</span>
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-96 rounded-[4px]" />
            ))}
          </div>
        ) : null}

        {state === "error" ? (
          <Empty className="rounded-[4px] border">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="rounded-[4px]">
                <Gavel />
              </EmptyMedia>
              <EmptyTitle>Não foi possível carregar os lotes</EmptyTitle>
              <EmptyDescription>A vitrine continua no ar. Tente de novo em instantes.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" variant="outline" className="rounded-[4px]" onClick={() => void load(status)}>
                Tentar novamente
              </Button>
            </EmptyContent>
          </Empty>
        ) : null}

        {state === "empty" ? (
          <Empty className="rounded-[4px] border">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="rounded-[4px]">
                <Gavel />
              </EmptyMedia>
              <EmptyTitle>{emptyCopy[status].title}</EmptyTitle>
              <EmptyDescription>{emptyCopy[status].description}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {state === "ready" && visible.length === 0 ? (
          <Empty className="rounded-[4px] border">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="rounded-[4px]">
                <SearchX />
              </EmptyMedia>
              <EmptyTitle>Nenhuma carta encontrada</EmptyTitle>
              <EmptyDescription>
                {searching
                  ? `Nenhum lote com “${query.trim()}” neste filtro.`
                  : emptyCopy[status].description}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {state === "ready" && visible.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((lot) => (
              <LotCard key={lot.id} lot={lot} now={now} />
            ))}
          </ul>
        ) : null}
      </main>
    </div>
  )
}
