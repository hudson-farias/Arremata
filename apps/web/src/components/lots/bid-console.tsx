import type { FormEvent } from "react"
import { Clock, Gavel } from "lucide-react"

import {
  bidCountLabel,
  bidFloorLabel,
  bidKey,
  formatLotDate,
  formatLotMoney,
  statusLabel,
  type ShowcaseLot,
  type ShowcaseStatus,
} from "@/components/lots/model"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"

function StatusBadge({ status, cancelled }: { status: ShowcaseStatus; cancelled: boolean }) {
  if (cancelled) return <Badge variant="destructive">Cancelado</Badge>

  const variant = status === "live" ? "default" : status === "closed" ? "secondary" : "outline"

  return (
    <Badge variant={variant}>
      {status === "live" ? <span className="size-1.5 animate-pulse rounded-full bg-primary-foreground" aria-hidden /> : null}
      {status === "scheduled" ? <span className="size-1.5 rounded-full bg-primary" aria-hidden /> : null}
      {statusLabel(status)}
    </Badge>
  )
}

function ClockReadout({
  lot,
  remaining,
  extended,
  cancelled,
}: {
  lot: ShowcaseLot
  remaining: string | null
  extended: boolean
  cancelled: boolean
}) {
  if (cancelled) {
    return (
      <p className="flex flex-col items-end gap-0.5 text-right">
        <span className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">Pregão</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-sm text-foreground">
          <Clock className="size-3.5 text-primary" aria-hidden />
          Cancelado
        </span>
      </p>
    )
  }

  if (lot.status === "closed" || remaining === "Encerrado") {
    return (
      <p className="flex flex-col items-end gap-0.5 text-right">
        <span className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">Pregão</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-sm text-foreground">
          <Clock className="size-3.5 text-primary" aria-hidden />
          Encerrado
        </span>
      </p>
    )
  }

  if (lot.status === "scheduled") {
    return (
      <p className="flex flex-col items-end gap-0.5 text-right">
        <span className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">Início</span>
        <span className="inline-flex items-center gap-1.5 text-right font-mono text-sm text-foreground">
          <Clock className="size-3.5 shrink-0 text-primary" aria-hidden />
          {formatLotDate(lot.startsAt) ?? "—"}
        </span>
      </p>
    )
  }

  return (
    <p className="flex flex-col items-end gap-0.5 text-right">
      <span className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">Encerramento</span>
      <span role="timer" className="inline-flex items-center gap-1.5 font-mono text-sm text-foreground">
        <Clock className="size-3.5 text-primary" aria-hidden />
        {remaining ?? "—"}
      </span>
      {extended ? <span className="text-[0.65rem] text-muted-foreground">Prorrogado +2 min</span> : null}
    </p>
  )
}

export function BidConsole({
  lot,
  remaining,
  extended,
  open,
  cancelled,
  refunded,
  position,
  viewerId,
  amount,
  error,
  pending,
  onAmountChange,
  onSubmit,
}: {
  lot: ShowcaseLot
  remaining: string | null
  extended: boolean
  open: boolean
  cancelled: boolean
  refunded: boolean
  position: "winning" | "outbid" | null
  viewerId: number | null
  amount: string
  error: string | null
  pending: boolean
  onAmountChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const hasCurrent = lot.currentBid != null
  const shown = hasCurrent ? lot.currentBid : lot.minimumBid
  const hint = open ? bidFloorLabel(lot) : null
  const describedBy = [error ? "lot-bid-error" : null, hint || !open ? "lot-bid-hint" : null].filter(Boolean).join(" ") || undefined

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <StatusBadge status={lot.status} cancelled={cancelled} />
          <ClockReadout lot={lot} remaining={remaining} extended={extended} cancelled={cancelled} />
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4">
          <span className="text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase">
            {hasCurrent ? "Lance atual" : "Lance mínimo"}
          </span>
          <p className="font-mono text-3xl text-primary">{formatLotMoney(shown)}</p>
          <p className="text-sm text-muted-foreground">{bidCountLabel(lot.bidCount)}</p>
          {cancelled && refunded ? (
            <p className="text-sm text-muted-foreground">O valor comprometido voltou ao disponível.</p>
          ) : null}
          {!cancelled && position === "winning" ? <p className="text-sm font-medium text-primary">Ganhando</p> : null}
          {!cancelled && position === "outbid" ? <p className="text-sm font-medium text-muted-foreground">Superado</p> : null}
        </div>

        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="lot-bid">Seu lance</FieldLabel>
            <InputGroup className="h-11">
              <InputGroupAddon>
                <InputGroupText>R$</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="lot-bid"
                name="bid"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={amount}
                disabled={!open || pending}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy}
                onChange={(event) => onAmountChange(event.target.value)}
              />
            </InputGroup>
            {hint ? <FieldDescription id="lot-bid-hint">{hint}</FieldDescription> : null}
            {error ? <FieldError id="lot-bid-error">{error}</FieldError> : null}
          </Field>

          <Button type="submit" className="h-11 w-full" disabled={!open || pending}>
            {pending ? <Spinner data-icon="inline-start" /> : <Gavel data-icon="inline-start" />}
            Dar lance
          </Button>

          {open ? null : (
            <p id="lot-bid-hint" className="text-center text-sm text-muted-foreground">
              {cancelled ? "O lote foi cancelado." : "O pregão não está aberto."}
            </p>
          )}
        </form>

        {lot.bids.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <h2 className="text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase">Lances</h2>
            <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto overscroll-y-contain pr-1">
              {lot.bids.map((bid) => (
                <li
                  key={bidKey(bid)}
                  className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto] items-baseline gap-3 text-sm"
                >
                  <span className="font-mono text-foreground">{formatLotMoney(bid.amount)}</span>
                  <span className="text-muted-foreground">{formatLotDate(bid.createdAt) ?? "—"}</span>
                  <span className="text-right text-foreground">
                    {viewerId != null && bid.bidderId === viewerId ? "Você" : `Licitante #${bid.bidderId}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
