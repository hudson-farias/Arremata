"use client"

import { useEffect, useRef, useState } from "react"
import { Table2 } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

import { CardPortrait } from "@/components/auctioneer/card-portrait"
import {
  canCancelLot,
  closedWithoutWinner,
  formatCollectorNumber,
  formatMoney,
  minimumBidTotal,
  statusLabel,
  type AuctionLot,
  type LotStatus,
} from "@/components/auctioneer/model"
import { auctioneerLogin } from "@/components/auctioneer/requests"

const displayFont = "[font-family:Georgia,Palatino,'Times_New_Roman',serif]"

type LotsState = "loading" | "error" | "empty" | "ready"

type LotsPayload = { status: number; lots: AuctionLot[] }

function viewOf(payload: LotsPayload): { lots: AuctionLot[]; state: LotsState } {
  if (payload.status < 200 || payload.status >= 300) return { lots: [], state: "error" }
  if (payload.lots.length === 0) return { lots: [], state: "empty" }
  return { lots: payload.lots, state: "ready" }
}

function StatusBadge({ status }: { status: LotStatus | null }) {
  const variant =
    status === "live" ? "default" : status === "cancelled" ? "destructive" : status === "closed" ? "secondary" : "outline"

  return (
    <Badge variant={variant}>
      {status === "live" ? <span className="size-1.5 animate-pulse rounded-full bg-primary-foreground" aria-hidden /> : null}
      {status === "scheduled" ? <span className="size-1.5 rounded-full bg-primary" aria-hidden /> : null}
      {statusLabel(status)}
    </Badge>
  )
}

function LotAction({ lot, onCancel }: { lot: AuctionLot; onCancel: (lot: AuctionLot) => void }) {
  if (canCancelLot(lot)) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => onCancel(lot)}>
        Cancelar
      </Button>
    )
  }

  if (closedWithoutWinner(lot)) {
    return <span className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Sem vencedor</span>
  }

  if (lot.bidCount > 0) {
    return (
      <span className="text-xs text-muted-foreground">
        {lot.bidCount === 1 ? "1 lance" : `${lot.bidCount} lances`}
      </span>
    )
  }

  return null
}

export function MyLots({
  revision,
  initialLots,
  listLots,
  cancelLot,
}: {
  revision: number
  initialLots: LotsPayload
  listLots: () => Promise<LotsPayload>
  cancelLot: (id: string) => Promise<{ status: number }>
}) {
  const initial = viewOf(initialLots)
  const [lots, setLots] = useState<AuctionLot[]>(initial.lots)
  const [state, setState] = useState<LotsState>(initial.state)
  const [target, setTarget] = useState<AuctionLot | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [reload, setReload] = useState(0)
  const skipReload = useRef(true)

  useEffect(() => {
    if (skipReload.current) {
      skipReload.current = false
      return
    }

    let active = true

    async function load() {
      setState("loading")
      try {
        const payload = await listLots()
        if (!active) return
        if (payload.status === 401) {
          window.location.href = auctioneerLogin
          return
        }

        const next = viewOf(payload)
        setLots(next.lots)
        setState(next.state)
      } catch {
        if (!active) return
        setLots([])
        setState("error")
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [revision, reload, listLots])

  async function confirmCancel() {
    if (!target || cancelling) return
    setCancelling(true)

    try {
      const response = await cancelLot(target.id)
      if (response.status === 401) {
        window.location.href = auctioneerLogin
        return
      }

      if (response.status < 200 || response.status >= 300) {
        toast.error("Não foi possível cancelar o lote.")
        return
      }

      toast.success("Lote cancelado.")
      setTarget(null)
      setReload((current) => current + 1)
    } catch {
      toast.error("Não foi possível cancelar o lote.")
    } finally {
      setCancelling(false)
    }
  }

  const total = minimumBidTotal(state === "ready" ? lots : [])

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Table2 className="size-5 text-primary" aria-hidden />
            <div className="flex flex-col gap-1">
              <CardTitle>
                <h2 className={cn(displayFont, "text-2xl tracking-tight text-primary")}>Meus lotes</h2>
              </CardTitle>
            </div>
          </div>
          {total != null ? (
            <p className="flex items-center gap-2 text-xs tracking-[0.12em] text-muted-foreground uppercase">
              Lances mínimos
              <span className="text-sm text-primary">{formatMoney(total)}</span>
            </p>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        {state === "loading" ? (
          <div className="flex flex-col gap-3" role="status" aria-live="polite">
            <span className="sr-only">Carregando lotes</span>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : null}

        {state === "error" ? (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível carregar os lotes</AlertTitle>
            <AlertDescription>A lista fica vazia até a API responder. O restante do painel continua disponível.</AlertDescription>
          </Alert>
        ) : null}

        {state === "empty" ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Table2 />
              </EmptyMedia>
              <EmptyTitle>Nenhum lote</EmptyTitle>
              <EmptyDescription>Os lotes que você criar aparecem aqui, com o selo de status.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {state === "ready" ? (
          <Table containerClassName="max-h-96 overflow-y-auto overscroll-y-contain">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="bg-card">Lote</TableHead>
                <TableHead className="bg-card">Edição</TableHead>
                <TableHead className="bg-card">Lance mínimo</TableHead>
                <TableHead className="bg-card">Status</TableHead>
                <TableHead className="bg-card text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lots.map((lot) => (
                <TableRow key={lot.id} className={cn(lot.status === "closed" && "opacity-75")}>
                  <TableCell className="whitespace-normal">
                    <div className="flex items-center gap-3">
                      <div className="w-10 shrink-0 overflow-hidden rounded-md border border-border bg-background">
                        <CardPortrait key={lot.imageUrl ?? lot.id} src={lot.imageUrl} alt="" className="aspect-[3/4] w-full" />
                      </div>
                      <span className="font-medium">{lot.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <span className="block">{lot.setName || "—"}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[lot.rarity, formatCollectorNumber(lot.number)].filter((item) => item && item !== "—").join(" · ") || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-primary">{formatMoney(lot.minimumBid)}</TableCell>
                  <TableCell>
                    <StatusBadge status={lot.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <LotAction lot={lot} onCancel={setTarget} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>

      <Dialog
        open={target != null}
        onOpenChange={(open) => {
          if (!open && !cancelling) setTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar lote</DialogTitle>
            <DialogDescription>
              {target
                ? `${target.title} sai do pregão. O cancelamento só fica disponível sem lances e antes do encerramento.`
                : "Confirme o cancelamento do lote."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={cancelling} onClick={() => setTarget(null)}>
              Voltar
            </Button>
            <Button type="button" variant="destructive" disabled={cancelling} onClick={() => void confirmCancel()}>
              {cancelling ? <Spinner data-icon="inline-start" /> : null}
              Cancelar lote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
