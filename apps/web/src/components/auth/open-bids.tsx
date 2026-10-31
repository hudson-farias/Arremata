"use client"

import { useEffect, useState } from "react"
import { BadgeCheck, Gavel, Shield } from "lucide-react"

import type { LotSummary } from "@/components/auth/live-lot"
import { formatCents } from "@/lib/money"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export type OpenBidsState = "loading" | "empty" | "error" | "ready"

const displayFont = "[font-family:Georgia,Palatino,'Times_New_Roman',serif]"

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

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

function bidLine(count: number): string {
  if (count === 0) return "Nenhum lance registrado"
  if (count === 1) return "1 lance registrado"
  return `${count} lances registrados`
}

function DefaultCharizard() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-primary/40 bg-card px-2 py-1 text-[0.62rem] tracking-[0.14em] text-primary uppercase">
            Destaque do catálogo
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-[0.62rem] tracking-[0.14em] text-primary uppercase">
            <BadgeCheck className="size-3" aria-hidden />
            Certificado PSA autêntico
          </span>
        </div>
        <p className="font-mono text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">Registro #48192801</p>
      </div>

      <Card>
        <CardContent className="grid items-center gap-5 sm:grid-cols-[10.75rem_minmax(0,1fr)]">
          <div className="relative mx-auto w-40 sm:w-full">
            <div aria-hidden className="absolute -inset-2 rounded-lg bg-primary/20 blur-xl" />
            <img
              src="/catalog/charizard-1st-psa10.jpg"
              alt="Charizard 1st Edition Shadowless, PSA 10 Gem Mint, em slab"
              className="relative w-full rounded-lg object-contain shadow-xl"
            />
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="inline-flex items-center gap-1.5 text-[0.65rem] tracking-[0.14em] text-primary uppercase">
                <Gavel className="size-3.5" aria-hidden />
                Lote #084 — Pregão magno
              </p>
              <h3 className={cn(displayFont, "text-2xl leading-tight text-foreground")}>
                Charizard 1st Edition Shadowless
              </h3>
              <p className="text-sm text-foreground/90">Base Set 1999 · Holo Rare · Gem Mint PSA 10</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Exemplar de referência arquivística. Selagem original, centragem 50/50 e holografia sem dispersão.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 border-y border-border py-3">
              <p className="flex flex-col gap-0.5">
                <span className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">Lance atual</span>
                <span className="text-lg text-primary">{brl.format(2450000)}</span>
                <span className="text-[0.65rem] text-primary">Reserva de pregão atingida</span>
              </p>
              <p className="flex flex-col gap-0.5">
                <span className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">Fechamento</span>
                <span className="font-mono text-lg text-foreground">03h 42m 19s</span>
                <span className="text-[0.65rem] text-muted-foreground">28 lances registrados</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[0.62rem] tracking-[0.12em] text-muted-foreground uppercase">
              <p className="inline-flex items-center gap-1.5">
                <Shield className="size-3.5 text-primary" aria-hidden />
                Custódia: Cofre Forte São Paulo
              </p>
              <p>Proveniência #AA-998</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function OpenLotCard({ lot, now }: { lot: LotSummary; now: number }) {
  const remaining = lot.endsAt ? formatRemaining(lot.endsAt, now) : null
  const bid = lot.currentBid ?? lot.minimumBid
  const bidLabel = lot.currentBid != null ? "Lance atual" : "Lance mínimo"
  const specs = [lot.edition, lot.rarity, lot.grade].filter(Boolean)

  return (
    <li>
      <Card size="sm">
        <CardContent className={cn("grid gap-3", lot.imageUrl && "grid-cols-[4.25rem_minmax(0,1fr)]")}>
          {lot.imageUrl ? (
            <div className="overflow-hidden rounded-lg border border-border bg-background">
              <img src={lot.imageUrl} alt="" className="aspect-[3/4] w-full object-cover" />
            </div>
          ) : null}

          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className={cn(displayFont, "text-xl leading-tight break-words text-foreground")}>{lot.title}</h3>
              <Badge>
                <span className="size-1.5 animate-pulse rounded-full bg-primary-foreground" aria-hidden />
                Aberto
              </Badge>
            </div>

            {specs.length > 0 ? <p className="text-sm text-foreground/90">{specs.join(" · ")}</p> : null}

            {bid != null || remaining ? (
              <div className="grid grid-cols-2 gap-3">
                {bid != null ? (
                  <p className="flex flex-col gap-0.5">
                    <span className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">{bidLabel}</span>
                    <span className="text-lg text-primary">{formatCents(bid)}</span>
                  </p>
                ) : null}
                {remaining ? (
                  <p className="flex flex-col gap-0.5">
                    <span className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">Fechamento</span>
                    <span className="text-lg text-primary">{remaining}</span>
                  </p>
                ) : null}
              </div>
            ) : null}

            {lot.bidCount != null ? <p className="text-sm text-muted-foreground">{bidLine(lot.bidCount)}</p> : null}
          </div>
        </CardContent>
      </Card>
    </li>
  )
}

export function OpenBids({ state, lots }: { state: OpenBidsState; lots: LotSummary[] }) {
  const ticking = state === "ready" && lots.some((lot) => Boolean(lot.endsAt))
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!ticking) return

    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [ticking])

  return (
    <section aria-labelledby="open-bids-heading" aria-busy={state === "loading"} className="flex min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="open-bids-heading" className={cn(displayFont, "text-3xl leading-tight text-foreground")}>
          Lances em aberto
        </h2>
        <p className="text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">
          {state === "error" ? "Amostra do catálogo" : "Pregão ao vivo"}
        </p>
      </div>

      {state === "loading" ? (
        <div className="flex flex-col gap-3" role="status" aria-live="polite">
          <span className="sr-only">Carregando lances em aberto</span>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : null}

      {state === "error" ? <DefaultCharizard /> : null}

      {state === "empty" ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Gavel />
            </EmptyMedia>
            <EmptyTitle>Nenhum lance em aberto</EmptyTitle>
            <EmptyDescription>Os lotes no pregão aparecem aqui, com a carta e o lance atual.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {state === "ready" ? (
        <ul className="flex max-h-[min(32rem,60dvh)] flex-col gap-3 overflow-y-auto">
          {lots.map((lot) => (
            <OpenLotCard key={lot.key} lot={lot} now={now} />
          ))}
        </ul>
      ) : null}
    </section>
  )
}
