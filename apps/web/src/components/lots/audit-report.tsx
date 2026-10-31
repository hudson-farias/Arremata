import Link from "next/link"
import { ArrowLeft, Lock, ScrollText, Shield, ShieldCheck } from "lucide-react"

import {
  bidCountLabel,
  collectorLine,
  formatLotDate,
  formatLotMoney,
  type LotBid,
  type ShowcaseLot,
} from "@/components/lots/model"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

const displayFont = "[font-family:Georgia,Palatino,'Times_New_Roman',serif]"

const labelClass = "font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase"
const cardClass = "rounded-lg border border-border bg-card"

const columns = ["Ordem", "Horário", "Licitante", "Valor"] as const

type ChainPanel = {
  title: string
  body: string
  emptyBook: boolean
}

function chainPanel(lot: ShowcaseLot): ChainPanel | null {
  if (lot.bidCount === 0) {
    return {
      title: "Cadeia íntegra",
      body: "O livro de lances está vazio. Sem registros, não há o que adulterar.",
      emptyBook: true,
    }
  }

  if (lot.bids.length === 0) {
    return {
      title: "Cadeia não publicada",
      body: "O livro lance a lance ainda não é publicado.",
      emptyBook: false,
    }
  }

  return null
}

function bidTimestamp(createdAt: string): number {
  const time = Date.parse(createdAt)
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time
}

function openingBid(lot: ShowcaseLot): number | null {
  if (lot.bidCount === 0 || lot.bids.length === 0 || lot.bids.length < lot.bidCount) return null
  const rows = historyRows(lot)
  return rows.at(-1)?.bid.amount ?? null
}

function historyRows(lot: ShowcaseLot): { order: number; bid: LotBid }[] {
  const rows = [...lot.bids].sort((a, b) => bidTimestamp(b.createdAt) - bidTimestamp(a.createdAt))
  const full = rows.length === lot.bidCount

  return rows.map((bid, index) => ({
    bid,
    order: full ? rows.length - index : lot.bidCount - index,
  }))
}

function historyEmpty(bidCount: number): string {
  if (bidCount === 0) return "Nenhum lance neste lote"
  return "O livro lance a lance ainda não é publicado."
}

export function AuditReport({ lot }: { lot: ShowcaseLot }) {
  const specs = collectorLine(lot)
  const chain = chainPanel(lot)
  const ChainIcon = chain?.emptyBook ? ShieldCheck : Shield
  const currentBid = lot.currentBid == null ? "—" : formatLotMoney(lot.currentBid)
  const firstBid = openingBid(lot)
  const firstBidLabel = firstBid == null ? "—" : formatLotMoney(firstBid)
  const rows = historyRows(lot)

  return (
    <main className="flex flex-1 flex-col bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8 px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/lots/${lot.id}`}
            className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Voltar ao lote
          </Link>
          <p className="font-mono text-[13px] tracking-wider text-primary">Lote #{lot.id}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <h1 className={cn(displayFont, "text-3xl leading-tight tracking-tight text-foreground sm:text-4xl")}>
            {lot.title}
          </h1>
          {specs ? <p className="text-base text-muted-foreground">{specs}</p> : null}
        </div>

        {chain ? (
          <section className={cn(cardClass, "flex items-start gap-4 p-6")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-primary">
              <ChainIcon className="size-5" aria-hidden />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold text-foreground">{chain.title}</h2>
                {chain.emptyBook ? (
                  <span className="rounded-lg bg-primary px-2 py-0.5 font-mono text-[11px] tracking-[0.12em] text-primary-foreground uppercase">
                    Livro vazio
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">{chain.body}</p>
            </div>
          </section>
        ) : null}

        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <article className={cn(cardClass, "flex flex-col gap-2 p-6")}>
            <h2 className={labelClass}>Lances</h2>
            <p className="font-mono text-3xl text-foreground">{lot.bidCount}</p>
          </article>
          <article className={cn(cardClass, "flex flex-col gap-2 p-6")}>
            <h2 className={labelClass}>Primeiro lance</h2>
            <p className={cn("font-mono text-3xl", firstBid == null ? "text-foreground" : "text-primary")}>
              {firstBidLabel}
            </p>
          </article>
          <article className={cn(cardClass, "flex flex-col gap-2 p-6")}>
            <h2 className={labelClass}>Lance atual</h2>
            <p className={cn("font-mono text-3xl", lot.currentBid == null ? "text-foreground" : "text-primary")}>
              {currentBid}
            </p>
          </article>
        </section>

        <section className={cn(cardClass, "flex flex-col gap-4 p-6")}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-2">
            <h2 className="inline-flex items-center gap-2 font-mono text-sm tracking-wider text-muted-foreground uppercase">
              <ScrollText className="size-4" aria-hidden />
              Histórico
            </h2>
            <p className="font-mono text-[13px] text-muted-foreground">{bidCountLabel(lot.bidCount)}</p>
          </div>

          <Table
            containerClassName="max-h-96 overflow-y-auto overscroll-y-contain"
            className="font-mono text-[13px] text-foreground"
          >
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="border-border hover:bg-transparent">
                {columns.map((column) => (
                  <TableHead
                    key={column}
                    className={cn(labelClass, "h-10 bg-card px-4 font-semibold")}
                  >
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="p-0 whitespace-normal">
                    <Empty className="rounded-lg border border-dashed border-border bg-transparent">
                      <EmptyHeader>
                        <EmptyTitle className="font-mono text-sm font-medium text-muted-foreground">
                          {historyEmpty(lot.bidCount)}
                        </EmptyTitle>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(({ order, bid }) => (
                  <TableRow key={`${order}-${bid.createdAt}-${bid.bidderId}`} className="border-border">
                    <TableCell className="px-4">{order}</TableCell>
                    <TableCell className="px-4">{formatLotDate(bid.createdAt) ?? "—"}</TableCell>
                    <TableCell className="px-4">#{bid.bidderId}</TableCell>
                    <TableCell className="px-4 text-primary">{formatLotMoney(bid.amount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>Licitantes aparecem só pelo identificador público.</span>
          </p>
        </section>
      </div>
    </main>
  )
}
